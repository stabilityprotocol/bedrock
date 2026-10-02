# UI/UX Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 UI/UX issues: broken navbar navigation in app screens, black text on Contact page, em-dash removal, small font sizes, unclickable Launch App button, improved "not found" error messaging, and removal of the post-recording verification timeout.

**Architecture:** All fixes are frontend-only except the "not found" error text which also touches the backend 404 response. The navbar fix adds fallback navigation directly in the Navbar component so every screen gets working nav links without threading props. The verification timeout removal deletes the polling loop in SuccessScreen.

**Tech Stack:** React 18, MUI, Vite, Express (backend error text only)

---

## Critical Files

| File | Changes |
|------|---------|
| `frontend/src/app/components/navbar.jsx` | Add fallback navigation when handlers aren't provided (fixes #1, #5) |
| `frontend/src/app/components/contact-page.jsx` | Fix text colors, remove em-dashes (#2, #3) |
| `frontend/src/app/components/faq-page.jsx` | Remove em-dashes, increase font sizes (#3, #4) |
| `frontend/src/app/components/instructions-page.jsx` | Increase font sizes (#4) |
| `frontend/src/app/components/landing-page.jsx` | Remove user-facing em-dashes (#3) |
| `frontend/src/app/components/success-screen.jsx` | Remove verification polling, remove em-dashes (#3, #6) |
| `frontend/src/app/components/verification-result.jsx` | Replace em-dashes, update "not found" text (#3, #6) |
| `frontend/src/lib/recording.js` | Replace em-dash placeholders (#3) |
| `backend/src/index.js` | Update 404 error text to mention segment-0 tampering (#6) |

---

## Task 1: Fix navbar navigation in app screens (Issues #1 and #5)

**Root cause:** App-level screens (`UploadScreen`, `VerificationLoading`, `VerificationResult`, `SuccessScreen`, `RecordingInterface`) render `<Navbar variant="light" />` without passing `onNavClick`, `onLogoClick`, or `onDemoClick`. This makes the navbar links white and unclickable.

**Fix:** Add fallback behavior in the Navbar component itself. When handlers aren't provided, clicking a nav item navigates to the landing page with that screen via `window.location.hash`.

**Files:**
- Modify: `frontend/src/app/components/navbar.jsx:34-37`

- [ ] **Step 1: Add fallback navigation to Navbar**

In `frontend/src/app/components/navbar.jsx`, replace the `handleNavItem` function and add a fallback for logo/Launch App clicks:

```jsx
// BEFORE (lines 34-37):
const handleNavItem = (screen) => {
  effectiveNavClick?.(screen);
  setDrawerOpen(false);
};

// AFTER:
const handleNavItem = (screen) => {
  if (effectiveNavClick) {
    effectiveNavClick(screen);
  } else {
    // Fallback: navigate to the landing page with the selected screen
    window.location.hash = '#/';
    // Small delay to let hash routing settle, then set screen via event
    window.dispatchEvent(new CustomEvent('bedrock-nav', { detail: { screen } }));
  }
  setDrawerOpen(false);
};

const handleLogoFallback = () => {
  if (onLogoClick) {
    onLogoClick();
  } else {
    window.location.hash = '#/';
  }
};

const handleDemoFallback = () => {
  if (onDemoClick) {
    onDemoClick();
  } else {
    window.location.hash = '#/app';
  }
};
```

- [ ] **Step 2: Wire fallback handlers to the logo and Launch App button**

In the same file, find the logo `onClick` (the `Box` wrapping the `Logo` component) and replace its handler:

```jsx
// Logo click — find the Box with onClick={onLogoClick}
// Replace: onClick={onLogoClick}
// With:    onClick={handleLogoFallback}
```

Find the "Launch App" button `onClick` and replace:

```jsx
// "Launch App" button — find onClick={onDemoClick || onLogoClick}
// Replace: onClick={onDemoClick || onLogoClick}
// With:    onClick={handleDemoFallback}
```

- [ ] **Step 3: Listen for the custom nav event in App.jsx**

In `frontend/src/app/App.jsx`, add a listener inside the existing `useEffect` for hash changes (around line 58):

```javascript
// Inside the existing useEffect that listens for 'hashchange':
const onBedRockNav = (e) => {
  const screen = e.detail?.screen;
  if (screen) {
    setPage('landing');
    setCurrentScreen(screen);
  }
};
window.addEventListener('bedrock-nav', onBedRockNav);

// In the cleanup return:
return () => {
  window.removeEventListener('hashchange', onHashChange);
  window.removeEventListener('bedrock-nav', onBedRockNav);
};
```

---

## Task 2: Fix Contact page text colors (Issue #2)

**Root cause:** MUI's default theme sets body text to dark colors. While the component uses `brandColors.offWhite` for headings, some MUI components (e.g. `Typography` without explicit `sx.color`) may inherit the dark default.

**Files:**
- Modify: `frontend/src/app/components/contact-page.jsx`

- [ ] **Step 1: Ensure all Typography elements have explicit light colors**

Check every `<Typography>` in `contact-page.jsx`. Any that do NOT have an explicit `color` in their `sx` prop must get one. The standard pattern:
- Headings: `color: brandColors.offWhite`
- Body text: `color: "rgba(244,238,255,0.72)"`
- Labels/meta: `color: "rgba(244,238,255,0.4)"`

Specifically look for any `<Typography>` or `<Box>` with text that has no color set, or uses MUI default variants like `variant="body1"` without overriding color. Also check MUI `<Button>` text colors.

- [ ] **Step 2: Add a root-level color override to the page container**

At the top-level `<Box>` of the ContactPage component, add a catch-all:

```jsx
<Box sx={{
  minHeight: '100vh',
  color: brandColors.offWhite,  // ADD THIS — ensures all children default to light text
  background: '...',  // existing background
  // ...existing styles
}}>
```

Apply the same pattern to `faq-page.jsx` and `instructions-page.jsx` if they don't already have it.

---

## Task 3: Remove em-dashes from user-facing text (Issue #3)

**Files:**
- Modify: multiple files (listed below)

The em-dash character `—` must be removed from all user-facing strings. Code comments are left as-is.

- [ ] **Step 1: Fix `contact-page.jsx` (2 occurrences)**

Line 201 — replace:
```
"...or want to report an issue — reach out and we'll get back to you promptly."
```
with:
```
"...or want to report an issue, reach out and we'll get back to you promptly."
```

Line 277 — replace:
```
"Contact form coming soon — email us at"
```
with:
```
"Contact form coming soon. Email us at"
```

- [ ] **Step 2: Fix `success-screen.jsx` (3 occurrences)**

Line 74 — replace `finalHash || '—'` with `finalHash || '-'`

Line 75 — replace `firstTxHash || '—'` with `firstTxHash || '-'`

Line 316 — replace:
```
'Verifying on-chain — please wait'
```
with:
```
'Verifying on-chain, please wait'
```

- [ ] **Step 3: Fix `faq-page.jsx` (1 occurrence)**

Line 52 — replace:
```
"...a brief on-screen test — such as blinking or turning your head — that confirms..."
```
with:
```
"...a brief on-screen test, such as blinking or turning your head, that confirms..."
```

- [ ] **Step 4: Fix `verification-result.jsx` (multiple occurrences)**

Replace ALL user-facing `—` in this file:

| Line | Before | After |
|------|--------|-------|
| 40 | `hash \|\| '—'` | `hash \|\| '-'` |
| 56 | `Segment Analysis — Paper Trail` | `Segment Analysis` |
| 102 | `Segment ${i} — TAMPERED` | `Segment ${i}: TAMPERED` |
| 104 | `Segment ${i} — OK` | `Segment ${i}: OK` |
| 105 | `Segment ${i} — affected by earlier tampering` | `Segment ${i}: affected by earlier tampering` |
| 133 | `return '—'` (formatTime) | `return '-'` |
| 179 | `formatTime(start) + ' — ' + formatTime(end)` | `formatTime(start) + ' to ' + formatTime(end)` |
| 225 | `— click to inspect` | `, click to inspect` |
| 250 | `Segment {segmentIndex} — {rangeLabel}` | `Segment {segmentIndex}: {rangeLabel}` |
| 480 | `(${formatTime(...)} — ${formatTime(...)})` | `(${formatTime(...)} to ${formatTime(...)})` |

- [ ] **Step 5: Fix `recording.js` (2 user-visible occurrences)**

Line 107 — replace `opts.onLogReplace("—")` with `opts.onLogReplace("-")`

Line 108 — replace `opts.onFinalHash("—")` with `opts.onFinalHash("-")`

Line 384 — replace `rolling ? toHex(rolling) : "—"` with `rolling ? toHex(rolling) : "-"`

- [ ] **Step 6: Fix `landing-page.jsx` (3 user-visible occurrences)**

Line 843 — replace:
```
"Can this be edited?" — because almost anything can.
```
with:
```
"Can this be edited?" Because almost anything can.
```

Line 1274 — replace:
```
foundational —
```
with:
```
foundational.
```

Line 1335 — replace:
```
Record new evidence or verify an existing file — both take under a minute.
```
with:
```
Record new evidence or verify an existing file. Both take under a minute.
```

---

## Task 4: Increase font sizes for left column and page headings (Issue #4)

**Files:**
- Modify: `frontend/src/app/components/faq-page.jsx`
- Modify: `frontend/src/app/components/instructions-page.jsx`
- Modify: `frontend/src/app/components/contact-page.jsx`

- [ ] **Step 1: Increase page heading sizes across all three pages**

In each page, find the main hero `<Typography>` (the page title) and increase its font size:

```jsx
// BEFORE (all three pages):
fontSize: { xs: '2.25rem', md: '3.5rem' }

// AFTER:
fontSize: { xs: '2.5rem', md: '4rem' }
```

- [ ] **Step 2: Increase subtitle/body text sizes**

In each page, find the subtitle under the hero heading:

```jsx
// BEFORE:
fontSize: { xs: '1rem', md: '1.125rem' }

// AFTER:
fontSize: { xs: '1.0625rem', md: '1.25rem' }
```

- [ ] **Step 3: Increase section heading sizes in FAQ and Instructions pages**

In `faq-page.jsx`, increase question text:
```jsx
// BEFORE:
fontSize: { xs: '0.9375rem', md: '1rem' }
// AFTER:
fontSize: { xs: '1rem', md: '1.125rem' }
```

In `instructions-page.jsx`, increase step title text:
```jsx
// BEFORE:
fontSize: { xs: '1.0625rem', md: '1.1875rem' }
// AFTER:
fontSize: { xs: '1.125rem', md: '1.3125rem' }
```

- [ ] **Step 4: Increase category label sizes**

In `faq-page.jsx`, increase category labels:
```jsx
// BEFORE:
fontSize: '0.6875rem'
// AFTER:
fontSize: '0.8125rem'
```

In `instructions-page.jsx`, increase step number labels:
```jsx
// BEFORE:
fontSize: '0.75rem'
// AFTER:
fontSize: '0.875rem'
```

---

## Task 5: Update "video not found on chain" error page (Issue #6, part 1)

**Root cause:** When `computeFirstHash` can't find a matching subcontract, the error only says "not found." It should explain that this could mean the video was tampered at the very first segment (segment 0), which changes the first hash and makes the video unrecognizable.

**Files:**
- Modify: `backend/src/index.js:592-596`
- Modify: `frontend/src/app/components/verification-result.jsx:359-412` (error state)

- [ ] **Step 1: Update backend 404 response text**

In `backend/src/index.js`, find lines 592-596:

```javascript
// BEFORE:
if (!subcontractAddress) {
  return res.status(404).json({
    error: "No matching recording found on-chain for this video.",
    hint: "The recording may still be processing. If you just recorded this, wait a minute and try again.",
  });
}

// AFTER:
if (!subcontractAddress) {
  return res.status(404).json({
    error: "No matching recording found on-chain for this video.",
    hint: "This can happen if: (1) the video was modified in the very first segment, changing its identity hash, or (2) the recording is still being written to the blockchain. If you just recorded this, wait a minute and try again.",
  });
}
```

- [ ] **Step 2: Update the frontend error display for the "not found" case**

In `frontend/src/app/components/verification-result.jsx`, find the error state block where `isNotFound` is true (around line 234). Replace the simple Alert with a more informative explanation:

```jsx
// BEFORE:
{isNotFound ? (
  <Alert severity="warning" sx={{ mb: 4, bgcolor: brandColors.warningSurface, border: "2px solid", borderColor: brandColors.warningMain }}>
    <Typography variant="body2">{result.hint}</Typography>
  </Alert>
) : (

// AFTER:
{isNotFound ? (
  <Box sx={{ mb: 4 }}>
    <Alert severity="warning" sx={{ mb: 2, bgcolor: brandColors.warningSurface, border: "2px solid", borderColor: brandColors.warningMain }}>
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Possible causes:</Typography>
      <Typography variant="body2" component="div">
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>The video was modified at the very beginning (segment 0), which changes the identity hash used to look up the blockchain record.</li>
          <li>The recording is still being written to the blockchain. If you just recorded this, wait a minute and try again.</li>
        </ul>
      </Typography>
    </Alert>
  </Box>
) : (
```

---

## Task 6: Remove post-recording verification timeout (Issue #6, part 2)

**Root cause:** After recording completes, `SuccessScreen` polls `/api/subcontract/:address/status` every 2 seconds with a 60-second timeout. This timeout fires frequently because the blockchain writes for all segments can take longer than 60 seconds (each segment takes ~5-15 seconds, and with 5-6 segments that's 25-90 seconds).

**Fix:** Remove the polling entirely. The success screen should show the download buttons immediately without waiting for blockchain confirmation. The blockchain writes happen in the background and don't affect the user's ability to download their video or certificate.

**Files:**
- Modify: `frontend/src/app/components/success-screen.jsx`

- [ ] **Step 1: Remove the polling constants and useEffect**

Delete lines 21-22:
```javascript
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 60_000;
```

Delete the entire polling `useEffect` (lines 123-149):
```javascript
// DELETE this entire useEffect block:
useEffect(() => {
  if (!subcontractAddress) return;
  const start = Date.now();
  const timer = setInterval(async () => {
    // ... entire polling logic
  }, POLL_INTERVAL_MS);
  return () => clearInterval(timer);
}, [subcontractAddress]);
```

- [ ] **Step 2: Remove polling state variables**

Remove from the state declarations (line 113-115):
```javascript
const [verifyStatus, setVerifyStatus] = useState('not_started');
const [verifySummary, setVerifySummary] = useState(null);
const [verifyError, setVerifyError] = useState(null);
```

And remove the derived state (line 151):
```javascript
const isHashing = verifyStatus === 'not_started' || verifyStatus === 'pending';
```

- [ ] **Step 3: Remove all UI references to the polling state**

Find and remove any JSX that references `verifyStatus`, `verifySummary`, `verifyError`, or `isHashing`. This includes:
- The "Verifying on-chain" status indicator
- The timeout error message
- Any conditional rendering based on `isHashing`

Replace the status indicator section with a simple confirmation:

```jsx
<Typography variant="body2" sx={{ color: brandColors.gray300 }}>
  Your recording is being written to the blockchain. You can download your video and certificate now.
</Typography>
```

- [ ] **Step 4: Remove the `api` import if no longer used**

Check if `import { api } from '@/lib/api'` is still needed after removing the polling. If the only usage was the status poll, remove the import.

---

## Verification

After all tasks are complete:

- [ ] Open the app at the Cloud Run URL
- [ ] From the verify/upload page, click FAQ, Instructions, Contact in the navbar. They should navigate correctly, not be white/dead.
- [ ] From the verify page, click the logo/Launch App. It should return to the landing or app home.
- [ ] Open the Contact page. All text should be light on the dark background (no black text).
- [ ] Search all visible text for em-dashes. None should remain.
- [ ] Check FAQ, Instructions, Contact page headings. They should be noticeably larger.
- [ ] Record a video. The success screen should NOT show a "timed out" error. It should show download buttons immediately.
- [ ] Upload a video that is NOT on chain. The error page should mention "modified at the very beginning (segment 0)" as a possible cause.
