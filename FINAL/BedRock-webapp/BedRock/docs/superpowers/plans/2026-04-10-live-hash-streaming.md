# Live Hash Streaming + Remove Static Call Preflight

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stream hash records to the blockchain during recording instead of batching them all after stop, and remove the redundant staticCall preflight from the blockchain writer.

**Architecture:** The Recorder module already calls `onHashRecord` after each segment is hashed during recording, and `onHashesReady` with the full array after stop. We change the frontend to submit each hash individually via `onHashRecord` (marking none as final), then submit only the last remaining hash with `isFinalHash: true` in `onHashesReady`. On the backend, we remove the staticCall preflight since `awaitReceipt` already enforces `receipt.status === 1`. No backend API changes needed — `/api/hashes/submit` already accepts arrays of any length.

**Tech Stack:** React (Next.js), BullMQ, ethers.js, Express

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `frontend/src/app/components/recording-interface.jsx:541-577` | Change `onHashRecord` to stream each hash, change `onHashesReady` to submit only the final hash |
| Modify | `backend/src/blockchain-writer.js:1-7,111-121,149-155` | Remove staticCall preflight block, update JSDoc and timing log |

---

### Task 1: Frontend — Stream hashes during recording via `onHashRecord`

**Files:**
- Modify: `frontend/src/app/components/recording-interface.jsx:541-544`

The current `onHashRecord` (line 541-544) just stores the record in a ref. We change it to submit the *previous* record to the backend (with `isFinalHash: false`) and hold the current record as the new "previous". This way every hash except the very last streams to the backend while the user is still recording.

- [ ] **Step 1: Replace the `onHashRecord` callback**

In `frontend/src/app/components/recording-interface.jsx`, replace lines 541-544:

```jsx
// BEFORE (lines 541-544):
onHashRecord: async (record) => {
  // Track the latest hash locally; all hashes are submitted in batch via onHashesReady.
  pendingHashRecordRef.current = record;
},
```

With:

```jsx
// AFTER:
onHashRecord: async (record) => {
  // Stream the previous record to the backend during recording.
  // The current record is held back — it might be the final one.
  if (pendingHashRecordRef.current && recordingIdRef.current && subcontractAddress) {
    fetch("/api/hashes/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recordingId: recordingIdRef.current,
        subcontractAddress,
        hashes: [{ ...pendingHashRecordRef.current, isFinalHash: false }],
      }),
    }).catch((err) => console.error("[hash submit]", err.message));
  }
  pendingHashRecordRef.current = record;
},
```

Note: The `fetch` is intentionally fire-and-forget (no `await`). The BullMQ queue handles ordering via `jobId` deduplication and priority, so we don't need to block the recorder waiting for the HTTP response.

- [ ] **Step 2: Verify the app builds**

Run:
```bash
cd frontend && npm run build
```
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/components/recording-interface.jsx
git commit -m "feat(frontend): stream hash records to backend during recording

Instead of batching all hashes after stop, onHashRecord now submits
the previous segment's hash to /api/hashes/submit as each new segment
arrives. The current record is held back since it might be the final one."
```

---

### Task 2: Frontend — Submit only the final hash in `onHashesReady`

**Files:**
- Modify: `frontend/src/app/components/recording-interface.jsx:546-577`

The current `onHashesReady` receives the full `hashes` array and submits all of them. After Task 1, all hashes except the last have already been submitted during recording. We change `onHashesReady` to submit only the single remaining record from `pendingHashRecordRef` with `isFinalHash: true`.

- [ ] **Step 1: Replace the `onHashesReady` callback**

In `frontend/src/app/components/recording-interface.jsx`, replace lines 546-577:

```jsx
// BEFORE (lines 546-577):
onHashesReady: async (hashes) => {
  if (!hashes?.length || !recordingIdRef.current || !subcontractAddress) return;
  // Mark only the last segment as the final hash for the blockchain writer.
  const hashesWithFinal = hashes.map((h, i) => ({
    ...h,
    isFinalHash: i === hashes.length - 1,
  }));
  const finalHashHex = hashes[hashes.length - 1].rollingHex;
  await fetch("/api/hashes/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recordingId: recordingIdRef.current,
      subcontractAddress,
      hashes: hashesWithFinal,
    }),
  }).catch((err) => console.error("[final hash submit]", err.message));
  pendingHashRecordRef.current = null;

  const duration = Math.round((Date.now() - recordingStartRef.current) / 1000);
  const timestamp = new Date()
    .toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    .toUpperCase();
  const videoBlob = getVideoBlob();
  onComplete(timestamp, duration, finalHashHex, videoBlob, recordingStartRef.current);
},
```

With:

```jsx
// AFTER:
onHashesReady: async (hashes) => {
  if (!pendingHashRecordRef.current || !recordingIdRef.current || !subcontractAddress) return;
  // Only the last hash remains un-submitted — send it with isFinalHash: true.
  const finalRecord = { ...pendingHashRecordRef.current, isFinalHash: true };
  const finalHashHex = finalRecord.rollingHex;
  await fetch("/api/hashes/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recordingId: recordingIdRef.current,
      subcontractAddress,
      hashes: [finalRecord],
    }),
  }).catch((err) => console.error("[final hash submit]", err.message));
  pendingHashRecordRef.current = null;

  const duration = Math.round((Date.now() - recordingStartRef.current) / 1000);
  const timestamp = new Date()
    .toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    .toUpperCase();
  const videoBlob = getVideoBlob();
  onComplete(timestamp, duration, finalHashHex, videoBlob, recordingStartRef.current);
},
```

- [ ] **Step 2: Verify the app builds**

Run:
```bash
cd frontend && npm run build
```
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/components/recording-interface.jsx
git commit -m "feat(frontend): submit only final hash in onHashesReady

All earlier hashes were already streamed during recording via onHashRecord.
onHashesReady now submits just the single remaining record with isFinalHash: true."
```

---

### Task 3: Backend — Remove staticCall preflight from blockchain writer

**Files:**
- Modify: `backend/src/blockchain-writer.js:1-7,111-121,149-155`

The staticCall preflight (step 6a, lines 111-121) simulates the on-chain call before submitting the real transaction. On ZGT (gasless chain), this adds ~100-200ms per segment for no benefit — reverts are already caught by `awaitReceipt` which enforces `receipt.status === 1` (see `backend/src/smartcontract/ReceiptService.js:63-72`). Remove the staticCall block, the `staticMs` timing variable, and update the JSDoc + timing log.

- [ ] **Step 1: Update the JSDoc header**

In `backend/src/blockchain-writer.js`, replace lines 1-7:

```javascript
// BEFORE (lines 1-7):
/**
 * Blockchain Writer — writes each rolling hash to the Subcontract on-chain.
 *
 * Three-step sequence per hash job:
 *   6a — staticCall preflight: simulate addCumulativeHash to catch reverts before spending gas
 *   6b — addCumulativeHashDirect: submit the real transaction
 *   6c — awaitReceipt + parse HashRecorded event to validate the emitted hash
```

With:

```javascript
// AFTER:
/**
 * Blockchain Writer — writes each rolling hash to the Subcontract on-chain.
 *
 * Two-step sequence per hash job:
 *   6a — addCumulativeHashDirect: submit the real transaction
 *   6b — awaitReceipt + parse HashRecorded event to validate the emitted hash
```

- [ ] **Step 2: Remove the staticCall preflight block**

In `backend/src/blockchain-writer.js`, delete lines 111-121 (the entire step 6a block):

```javascript
// DELETE these lines (111-121):
  // ── Step 6a — staticCall preflight ─────────────────────────────────────────
  // Simulates the call on-chain to catch reverts before spending any gas.
  const tStaticStart = Date.now();
  try {
    await contract.addCumulativeHash.staticCall(hash, isFinal, isFirst);
  } catch (err) {
    throw new Error(
      "[blockchain-writer] staticCall preflight failed (seg=" + index + "): " + err.message
    );
  }
  const staticMs = Date.now() - tStaticStart;
```

- [ ] **Step 3: Rename step comments from 6b/6c to 6a/6b**

In `backend/src/blockchain-writer.js`, update the remaining step comments:

Replace:
```javascript
  // ── Step 6b — Submit real transaction ──────────────────────────────────────
```
With:
```javascript
  // ── Step 6a — Submit real transaction ──────────────────────────────────────
```

Replace:
```javascript
  // ── Step 6c — Await receipt + validate HashRecorded event ──────────────────
```
With:
```javascript
  // ── Step 6b — Await receipt + validate HashRecorded event ──────────────────
```

- [ ] **Step 4: Update the timing log to remove `static=` field**

In `backend/src/blockchain-writer.js`, replace the timing log (lines 149-155):

```javascript
// BEFORE (lines 149-155):
  console.log(
    "[blockchain-writer] ⏱ seg=" + index +
    " | static=" + staticMs + "ms" +
    " | submit=" + submitMs + "ms" +
    " | receipt=" + receiptMs + "ms" +
    " | total=" + totalMs + "ms"
  );
```

With:

```javascript
// AFTER:
  console.log(
    "[blockchain-writer] ⏱ seg=" + index +
    " | submit=" + submitMs + "ms" +
    " | receipt=" + receiptMs + "ms" +
    " | total=" + totalMs + "ms"
  );
```

- [ ] **Step 5: Also update JSDoc line 22 which references the old behavior**

In `backend/src/blockchain-writer.js`, replace line 22:

```javascript
// BEFORE (line 22):
 *   - ReceiptService.awaitReceipt() only checks receipt.status === 1; HashRecorded
```

With:

```javascript
// AFTER:
 *   - ReceiptService.awaitReceipt() enforces receipt.status === 1 (catches reverts); HashRecorded
```

- [ ] **Step 6: Verify the backend starts**

Run:
```bash
cd backend && node -e "import('./src/blockchain-writer.js').then(() => console.log('OK'))"
```
Expected: `OK` (module parses and exports without errors).

- [ ] **Step 7: Commit**

```bash
git add backend/src/blockchain-writer.js
git commit -m "perf(backend): remove staticCall preflight from blockchain writer

On ZGT (gasless chain), the staticCall added ~100-200ms per segment
with no practical benefit. Reverts are already caught by awaitReceipt
which enforces receipt.status === 1."
```

---

## Verification Checklist

After all tasks are complete:

1. **Frontend build:** `cd frontend && npm run build` — must succeed
2. **Backend module parse:** `cd backend && node -e "import('./src/blockchain-writer.js').then(() => console.log('OK'))"` — must print OK
3. **Manual test:** Start a recording, observe browser DevTools Network tab — individual hash submits should appear during recording (one per segment), not all at once after stop
4. **Final hash:** After stopping, one final submit with `isFinalHash: true` should appear
5. **Chain timing:** Backend logs should show `submit=` and `receipt=` per segment but no `static=` field
