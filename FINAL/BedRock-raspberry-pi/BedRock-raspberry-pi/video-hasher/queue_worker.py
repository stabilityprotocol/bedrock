# queue_worker.py
#
# Python BullMQ worker that drains the local "pi-hash-chain" queue and
# delivers each recording's hash chain to the backend via POST /api/hashes/submit.
#
# Run as a companion process alongside main.py:
#   python3 queue_worker.py
#
# Each job carries the full payload for one recording:
#   { recordingId, subcontractAddress, hashes: [...] }
#
# On success the job is marked complete and removed after 1 hour.
# On failure (network error, 5xx) BullMQ retries up to 3 times with
# exponential backoff (5s → 10s → 20s), then moves the job to the
# FAILED set for manual inspection (kept 7 days).

import asyncio
import signal
import sys

import requests
from bullmq import Worker

from config import REDIS_URL, BACKEND_URL, BACKEND_TIMEOUT
from blockchain import _redis_conn

QUEUE_NAME = "pi-hash-chain"
_worker    = None


# ── Job processor ─────────────────────────────────────────────────────────────

async def process_job(job, token):
    """
    Called by BullMQ for every dequeued job.
    Raises on failure so BullMQ can apply retry/backoff.
    """
    data          = job.data
    recording_id  = data.get("recordingId", "unknown")
    contract_addr = data.get("subcontractAddress", "")
    hashes        = data.get("hashes", [])

    print(f"[WORKER] Processing '{recording_id}' — "
          f"{len(hashes)} segments → {contract_addr[:10]}...")

    url     = f"{BACKEND_URL}/api/hashes/submit"
    payload = {
        "recordingId":        recording_id,
        "subcontractAddress": contract_addr,
        "hashes":             hashes,
    }

    r = requests.post(url, json=payload, timeout=BACKEND_TIMEOUT)
    r.raise_for_status()   # non-2xx → exception → BullMQ retry

    queued = r.json().get("queued", "?")
    print(f"[WORKER] '{recording_id}' submitted — backend queued {queued} jobs.")


# ── Start / stop ──────────────────────────────────────────────────────────────

async def run():
    global _worker
    _worker = Worker(
        QUEUE_NAME,
        process_job,
        {
            "connection":  _redis_conn(REDIS_URL),
            "concurrency": 1,   # sequential — preserve recording order
        },
    )
    print(f"[WORKER] Listening on '{QUEUE_NAME}' @ {REDIS_URL} ...")

    # Keep running until cancelled
    stop_event = asyncio.Event()

    def _signal_handler():
        print("[WORKER] Shutdown signal received.")
        stop_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, _signal_handler)

    await stop_event.wait()

    print("[WORKER] Closing worker...")
    await _worker.close()
    print("[WORKER] Shutdown complete.")


if __name__ == "__main__":
    asyncio.run(run())
