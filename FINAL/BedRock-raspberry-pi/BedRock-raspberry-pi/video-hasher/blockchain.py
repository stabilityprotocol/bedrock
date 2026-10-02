# blockchain.py
#
# Responsibilities:
#   1. deploy_session_contract() — calls deploy.js to deploy a Subcontract
#   2. HashQueueWorker           — persistent background thread that enqueues
#      hash records to BullMQ in real time during recording.
#      On stop, drain() blocks until every hash is enqueued.

import asyncio
import json
import os
import queue
import subprocess
import threading
import time
from urllib.parse import urlparse

from bullmq import Queue

from config import REDIS_URL

QUEUE_NAME = "pi-hash-chain"

# Path to deploy.js (same directory as this file)
_DEPLOY_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "deploy.js")


# ── Redis connection ─────────────��────────────────────────────────────────────

def _redis_conn(url: str) -> dict:
    """Parse redis://[user:pass@]host[:port] into a bullmq connection dict."""
    try:
        u = urlparse(url)
        conn = {"host": u.hostname or "127.0.0.1", "port": u.port or 6379}
        if u.password:
            conn["password"] = u.password
        return conn
    except Exception:
        return {"host": "127.0.0.1", "port": 6379}


# ── Deploy ────────────────────────────────────────────────────────────────────

def deploy_session_contract() -> str | None:
    """
    Deploy a new Subcontract via the Grandfather factory on Stability.

    Calls deploy.js as a subprocess — all ethers.js / blockchain logic stays in Node.js.
    Returns the subcontract address string, or None on failure.
    """
    print("[BLOCKCHAIN] Deploying session subcontract...")
    try:
        result = subprocess.run(
            ["node", _DEPLOY_SCRIPT],
            capture_output=True,
            text=True,
            timeout=90,
            cwd=os.path.dirname(os.path.abspath(__file__)),
        )

        # deploy.js prints debug info to stderr, result JSON to stdout
        if result.stderr:
            for line in result.stderr.strip().splitlines():
                print(f"[BLOCKCHAIN]   {line}")

        stdout = result.stdout.strip()
        if not stdout:
            print("[BLOCKCHAIN] deploy.js returned no output")
            return None

        data = json.loads(stdout)

        if "error" in data:
            print(f"[BLOCKCHAIN] Deploy failed: {data['error']}")
            return None

        addr = data.get("subcontractAddress")
        block = data.get("deploymentBlock")
        signer = data.get("signerEoa")
        print(f"[BLOCKCHAIN] Subcontract deployed at {addr} (block {block}, signer {signer})")
        return addr

    except subprocess.TimeoutExpired:
        print("[BLOCKCHAIN] deploy.js timed out (90s)")
        return None
    except json.JSONDecodeError as e:
        print(f"[BLOCKCHAIN] Failed to parse deploy.js output: {e}")
        return None
    except FileNotFoundError:
        print("[BLOCKCHAIN] Node.js not found — is it installed?")
        return None
    except Exception as e:
        print(f"[BLOCKCHAIN] Deploy error: {e}")
        return None


# ── Enqueue (async core) ─────────────────────────────────────────────────────

async def _enqueue(job_data: dict, job_opts: dict):
    q = Queue(QUEUE_NAME, {"connection": _redis_conn(REDIS_URL)})
    await q.add("write-hash", job_data, job_opts)
    await q.close()


def _enqueue_sync(job_data: dict, job_opts: dict):
    """Synchronous wrapper around the async BullMQ enqueue."""
    asyncio.run(_enqueue(job_data, job_opts))


# ── HashQueueWorker — persistent real-time queue thread ──────────────────────

class HashQueueWorker:
    """
    Persistent background thread that accepts hash records via submit()
    and enqueues them to BullMQ sequentially. Thread-safe.

    Usage:
        worker = HashQueueWorker(contract_addr, recording_id)
        worker.start()
        worker.submit(record)       # non-blocking, from any thread
        worker.drain()              # blocks until all submitted records are enqueued
    """

    def __init__(self, contract_addr: str, recording_id: str):
        self.contract_addr = contract_addr
        self.recording_id  = recording_id
        self._q            = queue.Queue()
        self._thread       = None
        self._stop_event   = threading.Event()
        self.enqueued      = 0
        self.failed        = 0
        self.total_submitted = 0

    def start(self):
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, daemon=True,
                                        name="hash-queue-worker")
        self._thread.start()
        print(f"[BLOCKCHAIN] HashQueueWorker started for {self.recording_id}")

    def submit(self, record: dict):
        """Non-blocking: add a hash record to the internal queue."""
        self.total_submitted += 1
        self._q.put(record)

    def drain(self, timeout: float = 120.0) -> bool:
        """
        Block until all submitted records have been enqueued (or timeout).
        Returns True if all records were enqueued successfully.
        """
        print(f"[BLOCKCHAIN] Draining queue ({self.total_submitted} submitted, "
              f"{self.enqueued} enqueued so far)...")

        deadline = time.time() + timeout
        while not self._q.empty() or self.enqueued + self.failed < self.total_submitted:
            if time.time() >= deadline:
                print(f"[BLOCKCHAIN] Drain timeout! "
                      f"{self.enqueued}/{self.total_submitted} enqueued")
                return False
            time.sleep(0.2)

        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5)

        ok = self.failed == 0
        print(f"[BLOCKCHAIN] Drain complete: {self.enqueued}/{self.total_submitted} enqueued, "
              f"{self.failed} failed")
        return ok

    def _run(self):
        """Worker loop: pull records from internal queue, enqueue to BullMQ."""
        while not self._stop_event.is_set():
            try:
                record = self._q.get(timeout=0.5)
            except queue.Empty:
                continue

            idx      = record["index"]
            is_first = record.get("type") == "genesis"
            is_final = record.get("isFinalHash", False)

            job_data = {
                "recordingId":        self.recording_id,
                "subcontractAddress": self.contract_addr,
                "index":              idx,
                "segHashHex":         record["segHashHex"],
                "rollingHex":         record["rollingHex"],
                "isFirst":            is_first,
                "isFinal":            is_final,
                "timestamp":          record.get("timestamp", int(time.time() * 1000)),
            }
            job_opts = {
                "jobId":    f"{self.recording_id}:seg:{idx}",
                "priority": 1 if is_first else 2,
            }

            try:
                _enqueue_sync(job_data, job_opts)
                self.enqueued += 1
                print(f"[BLOCKCHAIN]   enqueued seg={idx}  "
                      f"hash={record['rollingHex'][:16]}…  "
                      f"({self.enqueued}/{self.total_submitted})")
            except Exception as e:
                self.failed += 1
                print(f"[BLOCKCHAIN]   FAILED seg={idx}: {e}")

            self._q.task_done()
