# Frontend Integration Plan: staging-final UI into aws-liveness

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the functional-but-plain frontend in `BedRock-aws-liveness-integrated-tomain` with the polished UI from `BedRock-frontend-staging-final`, while preserving all real backend integration (AWS Rekognition liveness, blockchain anchoring, verification pipeline).

**Architecture:** The aws-liveness project is the target — it has the working Express backend, BullMQ queue, smart contract integration, and AWS Rekognition. The staging-final project is a frontend-only prototype with mocked logic but polished UI (rich landing page, FAQ, instructions, contact form, animations). We copy staging-final's UI components into the aws-liveness frontend, then wire them to the real backend.

**Tech Stack:** React 18 + Vite 6 + MUI 7 + Tailwind CSS 4 + Radix UI + AWS Amplify Liveness + ethers.js + BullMQ

**Source (polished UI):** `/Users/vaibhav/Downloads/BedRock-frontend-staging-final/`
**Target (working backend):** `/Users/vaibhav/Downloads/BedRock-aws-liveness-integrated-tomain/frontend/`

---

## Execution Phases

### Phase 1: Foundation (Tasks 1-3)
**Scope:** Install dependencies, replace theme, copy UI primitives
**One agent does all three tasks, then runs the test gate.**

**Test Gate — must ALL pass before proceeding:**
1. `npx vite build` — zero errors
2. `grep -rn "255, 0, 200\|FF00C8\|ff00c8" frontend/src/app/components/` — no stale pink color refs in kept files
3. Verify `fontTokens`, `typeRoles`, `brandColors` are all exported from `frontend/src/theme.js`
4. Verify `brandColors.gold` exists (`grep "gold" frontend/src/theme.js`)
5. Verify new UI files exist: `ls frontend/src/app/components/ui/{chart,text-shimmer,timeline}.jsx`
6. Backend tests unchanged: `cd backend && npm test` — 48 pass

---

### Phase 2: Static Pages + Navbar Compat (Tasks 4-5)
**Scope:** Copy new pages, replace landing/navbar/logo, add navbar backward compatibility
**One agent does both tasks, then runs the test gate.**

**Test Gate — must ALL pass before proceeding:**
1. `npx vite build` — zero errors
2. Verify new page files exist: `ls frontend/src/app/components/{demo-screen,instructions-page,faq-page,contact-page,dotted-surface}.jsx`
3. Verify navbar accepts `variant` prop — grep for `variant` in the new navbar.jsx signature
4. Verify navbar accepts `onNavItemSelect` alias — grep for it in navbar.jsx
5. Verify every kept component that uses Navbar still builds:
   - `grep -l "Navbar" frontend/src/app/components/{recording-interface,upload-screen,verification-loading,verification-result,manual-fallback-modal}.jsx` — all should exist
   - For each: verify the Navbar prop they pass (`variant="light"`) is accepted by the new Navbar
6. Verify `NavItemKey` is NOT exported: `grep "NavItemKey" frontend/src/app/components/navbar.jsx` — should find nothing
7. `npx vite build` — still zero errors after all changes

---

### Phase 3: Component Merges (Tasks 6-9)
**Scope:** Merge setup-loading, success, upload, verification-result — each keeps real backend logic, gets staging-final UI polish
**One agent does all four merges, then runs the test gate.**

**Test Gate — must ALL pass before proceeding:**
1. `npx vite build` — zero errors
2. **setup-loading-screen.jsx integrity:**
   - `grep "api.post.*subcontract/deploy" frontend/src/app/components/setup-loading-screen.jsx` — real API call present
   - `grep "onComplete.*addr\|subcontractAddress" frontend/src/app/components/setup-loading-screen.jsx` — passes address to callback
3. **success-screen.jsx integrity:**
   - `grep "api.get.*subcontract.*status" frontend/src/app/components/success-screen.jsx` — blockchain polling present
   - `grep "videoBlob\|subcontractAddress\|finalHash" frontend/src/app/components/success-screen.jsx` — real data props present
   - `grep "generateCertificate\|certificate" frontend/src/app/components/success-screen.jsx` — cert generation present
4. **upload-screen.jsx integrity:**
   - `grep "onNeedsAddress\|onVerify.*file" frontend/src/app/components/upload-screen.jsx` — real dual-callback present
   - `grep "getVideoDuration" frontend/src/app/components/upload-screen.jsx` — duration extraction present
   - `grep "import.meta.env.DEV" frontend/src/app/components/upload-screen.jsx` — dev panel is guarded
5. **verification-result.jsx integrity:**
   - `grep "SegmentTimeline\|tampering\|divergence" frontend/src/app/components/verification-result.jsx` — real tampering analysis present
   - `grep "subcontractInfo\|onChainFinalHash" frontend/src/app/components/verification-result.jsx` — real blockchain data present
   - `grep "onVerifyAnother\|onBack" frontend/src/app/components/verification-result.jsx` — both callbacks present
6. **No mock logic leaked in:**
   - `grep -n "Math.random\|MOCK_HASH\|MOCK_TX\|isVerified.*true\|isVerified.*false" frontend/src/app/components/{setup-loading-screen,success-screen,upload-screen,verification-result}.jsx` — should find ZERO matches (no mock logic in production components)

---

### Phase 4: App.jsx Orchestrator + Full Integration (Tasks 10-11)
**Scope:** Merge App.jsx with hash routing + real backend handlers. Full smoke test.
**One agent does the App.jsx merge and full verification.**

**Test Gate — must ALL pass:**
1. `npx vite build` — zero errors, clean build
2. **Removed imports verified:**
   - `grep "AboutPage\|NavItemKey\|LivenessVerification" frontend/src/app/App.jsx` — should find ZERO matches
3. **Required imports present:**
   - `grep "RecordingInterface\|LivenessFailedScreen\|VerificationLoading\|ErrorBoundary" frontend/src/app/App.jsx` — all 4 present
   - `grep "DemoScreen\|InstructionsPage\|FaqPage\|ContactPage" frontend/src/app/App.jsx` — all 4 present
4. **Hash routing present:**
   - `grep "getPage\|goToApp\|goToLanding\|hashchange" frontend/src/app/App.jsx` — all present
5. **Real backend handlers present:**
   - `grep "subcontractAddress\|finalHash\|uploadedFile\|videoDuration\|verificationResult" frontend/src/app/App.jsx` — all state vars present
   - `grep "handleRecordingComplete\|handleUploadVerifyWithAddress\|handleManualVerify\|handleVerificationComplete" frontend/src/app/App.jsx` — all handlers present
6. **Screen flow correct:**
   - `grep "setup-loading\|recording\|liveness-failed\|verification-loading" frontend/src/app/App.jsx` — all real screens present
   - `grep "demo\|instructions\|faq\|contact" frontend/src/app/App.jsx` — all new pages present
7. **consentOrigin behavior:**
   - `grep "consentOrigin" frontend/src/app/App.jsx` — present
8. **Backend tests unchanged:**
   - `cd backend && npm test` — still 48 pass
9. **Clean build from scratch:**
   - `rm -rf frontend/dist frontend/node_modules/.vite && npx vite build` — success

---

## File Map

### Files to copy from staging-final (new):
- `src/app/components/demo-screen.jsx` — Record/Verify entry screen
- `src/app/components/instructions-page.jsx` — Workflow steps
- `src/app/components/faq-page.jsx` — FAQ accordion
- `src/app/components/contact-page.jsx` — Contact form (EmailJS)
- `src/app/components/dotted-surface.jsx` — Animated background
- `src/app/components/ui/chart.jsx` — Chart component
- `src/app/components/ui/text-shimmer.jsx` — Text effect
- `src/app/components/ui/timeline.jsx` — Timeline component

### Files to replace with staging-final version:
- `src/theme.js` — Richer: font tokens, typography roles, `gold` color (note: `pink` changes from `#FF00C8` to `#C026A0`)
- `src/app/components/landing-page.jsx` — 51KB vs simple: rich hero, How It Works, Audience, Footer
- `src/app/components/navbar.jsx` — Has mobile drawer, Instructions/FAQ/Contact nav items
- `src/app/components/logo.jsx` — More variants (icon-only, horizontal, large)
- `src/app/components/rotating-text.jsx` — Verify both versions are identical; if not, use staging-final

### Files to merge (staging-final UI + aws-liveness backend logic):
- `src/app/App.jsx` — Hash routing + new pages + real backend handlers
- `src/app/components/setup-loading-screen.jsx` — Staging animation + real deploy API
- `src/app/components/success-screen.jsx` — Staging cert modal + real blockchain polling
- `src/app/components/upload-screen.jsx` — Staging drag-drop + real file extraction
- `src/app/components/verification-result.jsx` — Staging layout + real hash comparison

### Files to KEEP from aws-liveness (no changes):
- `src/lib/api.js` — Real API client
- `src/lib/recording.js` — Real MediaRecorder + rolling hash
- `src/lib/hashing.js` — WebCrypto SHA-256
- `src/lib/certificate.js` — PDF certificate generation
- `src/lib/livenessCheck.js` — Deprecated Luxand fallback
- `src/app/components/recording-interface.jsx` — Real AWS FaceLiveness integration
- `src/app/components/liveness-failed-screen.jsx` — Liveness failure recovery
- `src/app/components/verification-loading.jsx` — Real API verification progress
- `src/app/components/error-boundary.jsx` — Error catching
- `src/styles/aws-liveness.css` — AWS component style overrides

### Files to REMOVE (replaced by staging-final equivalents):
- `src/app/components/about-page.jsx` — Replaced by Instructions/FAQ/Contact pages
- `src/app/components/liveness-verification.jsx` — Not needed; aws-liveness `recording-interface.jsx` handles liveness internally via AWS Rekognition

### Dead code (kept but unused — can be deleted):
- `src/app/components/dashboard.jsx` — Placeholder, not referenced
- `src/app/components/record.jsx` — Legacy placeholder
- `src/app/components/verify.jsx` — Legacy placeholder

---

## Task 1: Add missing dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Add staging-final dependencies missing from aws-liveness**

Run from the frontend directory:

```bash
cd /Users/vaibhav/Downloads/BedRock-aws-liveness-integrated-tomain/frontend
npm install @emailjs/browser@^4.4.1 recharts@2.15.2 three@^0.183.2
```

These packages are used by staging-final components:
- `@emailjs/browser` — contact-page.jsx
- `recharts` — chart.jsx UI component
- `three` — 3D effects (landing-page.jsx)

- [ ] **Step 2: Verify install succeeds**

Run: `npm ls @emailjs/browser recharts three`
Expected: All three packages listed without errors.

- [ ] **Step 3: Verify build still works**

Run: `cd /Users/vaibhav/Downloads/BedRock-aws-liveness-integrated-tomain/frontend && npx vite build`
Expected: Build succeeds (no new deps break anything).

---

## Task 2: Replace theme.js with staging-final's enriched version

**Files:**
- Replace: `frontend/src/theme.js`

- [ ] **Step 1: Copy staging-final theme.js over aws-liveness theme.js**

```bash
cp "/Users/vaibhav/Downloads/BedRock-frontend-staging-final/src/theme.js" \
   "/Users/vaibhav/Downloads/BedRock-aws-liveness-integrated-tomain/frontend/src/theme.js"
```

This brings in:
- `fontTokens` and `typeRoles` exports (font system)
- `gold: '#F4A554'` color (used in staging-final components)
- Richer typography config (Source Serif 4 for h1, IBM Plex Sans for h2-h6)
- `subtitle1`, `subtitle2`, `body2`, `caption` typography definitions

- [ ] **Step 2: Audit `pink` color change**

The `pink` value changes from `#FF00C8` (aws-liveness) to `#C026A0` (staging-final). Search kept aws-liveness components for hardcoded `rgba(255, 0, 200, ...)` values that were visually matched to the old pink:

```bash
grep -rn "255, 0, 200\|FF00C8\|ff00c8" frontend/src/app/components/
```

If found, update those hardcoded rgba values to match the new `#C026A0` → `rgba(192, 38, 160, ...)`.

- [ ] **Step 3: Verify build**

Run: `npx vite build`
Expected: Build succeeds. Existing components that import `brandColors` and `theme` from `@/theme` continue to work since all previous colors are preserved (except `pink` which is intentionally changed).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/theme.js frontend/package.json package-lock.json
git commit -m "feat: upgrade theme with font tokens and enriched typography from staging-final"
```

---

## Task 3: Copy new UI primitives from staging-final

**Files:**
- Create: `frontend/src/app/components/ui/chart.jsx`
- Create: `frontend/src/app/components/ui/text-shimmer.jsx`
- Create: `frontend/src/app/components/ui/timeline.jsx`

- [ ] **Step 1: Copy the 3 missing UI primitives**

```bash
SRC="/Users/vaibhav/Downloads/BedRock-frontend-staging-final/src/app/components/ui"
DST="/Users/vaibhav/Downloads/BedRock-aws-liveness-integrated-tomain/frontend/src/app/components/ui"
cp "$SRC/chart.jsx" "$SRC/text-shimmer.jsx" "$SRC/timeline.jsx" "$DST/"
```

- [ ] **Step 2: Verify build**

Run: `npx vite build`
Expected: Build succeeds. These are standalone components — no import wiring needed yet.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/components/ui/chart.jsx frontend/src/app/components/ui/text-shimmer.jsx frontend/src/app/components/ui/timeline.jsx
git commit -m "feat: add chart, text-shimmer, timeline UI primitives from staging-final"
```

---

## Task 4: Copy new page components from staging-final

**Files:**
- Create: `frontend/src/app/components/demo-screen.jsx`
- Create: `frontend/src/app/components/instructions-page.jsx`
- Create: `frontend/src/app/components/faq-page.jsx`
- Create: `frontend/src/app/components/contact-page.jsx`
- Create: `frontend/src/app/components/dotted-surface.jsx`

- [ ] **Step 1: Copy new page components**

```bash
SRC="/Users/vaibhav/Downloads/BedRock-frontend-staging-final/src/app/components"
DST="/Users/vaibhav/Downloads/BedRock-aws-liveness-integrated-tomain/frontend/src/app/components"
cp "$SRC/demo-screen.jsx" "$SRC/instructions-page.jsx" "$SRC/faq-page.jsx" "$SRC/contact-page.jsx" "$SRC/dotted-surface.jsx" "$DST/"
```

- [ ] **Step 2: Verify build**

Run: `npx vite build`
Expected: Build succeeds. These components aren't imported by App.jsx yet, so they're tree-shaken.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/components/demo-screen.jsx frontend/src/app/components/instructions-page.jsx frontend/src/app/components/faq-page.jsx frontend/src/app/components/contact-page.jsx frontend/src/app/components/dotted-surface.jsx
git commit -m "feat: add demo, instructions, FAQ, contact, dotted-surface pages from staging-final"
```

---

## Task 5: Replace landing-page, navbar, logo, rotating-text with staging-final versions + fix Navbar compatibility

**Files:**
- Replace: `frontend/src/app/components/landing-page.jsx`
- Replace: `frontend/src/app/components/navbar.jsx`
- Replace: `frontend/src/app/components/logo.jsx`
- Replace: `frontend/src/app/components/rotating-text.jsx` (verify both are identical first; if not, use staging-final)
- Modify: `frontend/src/app/components/navbar.jsx` (add backward-compatible props)

- [ ] **Step 1: Back up current versions for reference**

```bash
DST="/Users/vaibhav/Downloads/BedRock-aws-liveness-integrated-tomain/frontend/src/app/components"
cp "$DST/landing-page.jsx" "$DST/landing-page.jsx.bak"
cp "$DST/navbar.jsx" "$DST/navbar.jsx.bak"
cp "$DST/logo.jsx" "$DST/logo.jsx.bak"
```

- [ ] **Step 2: Copy staging-final versions**

```bash
SRC="/Users/vaibhav/Downloads/BedRock-frontend-staging-final/src/app/components"
DST="/Users/vaibhav/Downloads/BedRock-aws-liveness-integrated-tomain/frontend/src/app/components"
cp "$SRC/landing-page.jsx" "$SRC/navbar.jsx" "$SRC/logo.jsx" "$SRC/rotating-text.jsx" "$DST/"
```

- [ ] **Step 3: Add backward-compatible props to the staging-final Navbar**

Multiple kept aws-liveness components render `<Navbar variant="light" .../>` with the old prop interface. The staging-final Navbar does not accept `variant`, `activeItem`, or `onNavItemSelect`. Add compatibility for both prop patterns.

**Files that pass props to Navbar (must all work after this change):**
- `recording-interface.jsx` — passes `variant="light"` or similar
- `upload-screen.jsx` — passes `variant="light"`
- `verification-loading.jsx` — passes `variant="light"`
- `verification-result.jsx` — passes `variant="light"` via `ResultShell`
- `manual-fallback-modal.jsx` — passes `variant="light"`
- `App.jsx` (merged) — will use staging-final prop names

Add to the staging-final Navbar component signature:
```jsx
export function Navbar({
  onLogoClick, onDemoClick, onNavClick, currentScreen, disabled, inApp,
  // Backward-compat aliases for aws-liveness components:
  variant,           // 'light' | undefined — if 'light', use light bg
  activeItem,        // alias for currentScreen
  onNavItemSelect,   // alias for onNavClick
}) {
  const effectiveScreen = currentScreen || activeItem;
  const effectiveNavClick = onNavClick || onNavItemSelect;
  // ... use variant to toggle light/dark styling
}
```

**Do NOT export `NavItemKey`** — the merged App.jsx will not import it (the `NavItemKey` import from the old App.jsx is removed in Task 10).

- [ ] **Step 4: Verify build**

Run: `npx vite build`
Expected: Build succeeds. May have unused prop warnings — that's OK.

- [ ] **Step 5: Clean up backups after confirming build**

```bash
DST="/Users/vaibhav/Downloads/BedRock-aws-liveness-integrated-tomain/frontend/src/app/components"
rm -f "$DST/landing-page.jsx.bak" "$DST/navbar.jsx.bak" "$DST/logo.jsx.bak"
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/components/landing-page.jsx frontend/src/app/components/navbar.jsx frontend/src/app/components/logo.jsx frontend/src/app/components/rotating-text.jsx
git commit -m "feat: replace landing-page, navbar, logo with staging-final + add navbar backward compat"
```

---

## Task 6: Merge setup-loading-screen.jsx

**Strategy:** Use aws-liveness as base (has real `POST /api/subcontract/deploy`), port staging-final's animated logo.

**Files:**
- Modify: `frontend/src/app/components/setup-loading-screen.jsx`

- [ ] **Step 1: Read both versions**

Read:
- `/Users/vaibhav/Downloads/BedRock-frontend-staging-final/src/app/components/setup-loading-screen.jsx`
- `/Users/vaibhav/Downloads/BedRock-aws-liveness-integrated-tomain/frontend/src/app/components/setup-loading-screen.jsx`

- [ ] **Step 2: In the aws-liveness version, replace the AnimatedLoadingLogo component with staging-final's version**

The staging-final AnimatedLoadingLogo uses a draw/undraw SVG mask animation with `requestAnimationFrame` — smoother than the aws-liveness version's simpler gradient highlight. Port the staging-final's `AnimatedLoadingLogo` function (and its associated `useEffect` with canvas drawing) into the aws-liveness file, replacing the existing `AnimatedLoadingLogo`.

**Keep from aws-liveness:**
- The `onComplete` prop that receives `subcontractAddress`
- The real API call: `const res = await api.post('/api/subcontract/deploy')`
- The `deployData` state and `setSubcontractAddress` logic
- Error handling for API failures

**Port from staging-final:**
- The `AnimatedLoadingLogo` component (SVG draw/undraw animation)
- The retry button UI on error (staging-final has a proper retry)

- [ ] **Step 3: Verify build**

Run: `npx vite build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/components/setup-loading-screen.jsx
git commit -m "feat: upgrade setup-loading animation from staging-final, keep real deploy API"
```

---

## Task 7: Merge success-screen.jsx

**Strategy:** Use aws-liveness as base (has real blockchain polling + real downloads), port staging-final's certificate modal UI.

**Files:**
- Modify: `frontend/src/app/components/success-screen.jsx`

- [ ] **Step 1: Read both versions**

Read:
- `/Users/vaibhav/Downloads/BedRock-frontend-staging-final/src/app/components/success-screen.jsx`
- `/Users/vaibhav/Downloads/BedRock-aws-liveness-integrated-tomain/frontend/src/app/components/success-screen.jsx`

- [ ] **Step 2: Add staging-final's CertificateModal component to the aws-liveness version**

The staging-final has a `CertificateModal` component that shows certificate data in a styled dialog. Port this into the aws-liveness success-screen but replace mock data with real data:

- Replace `MOCK_HASH` with `finalHash` prop
- Replace `MOCK_TX` with `verifySummary?.firstTxHash` (from polling result)
- Replace mock download with real `generateCertificate()` call from `@/lib/certificate`
- Keep the aws-liveness "Download Video" button (creates real blob download)
- Keep the aws-liveness blockchain polling logic (`api.get('/api/subcontract/.../status')`)

**Keep from aws-liveness:**
- Props: `{ timestamp, duration, videoBlob, subcontractAddress, finalHash, onBack }`
- Polling loop: `fetchVerificationStatus()` with 2s interval, 60s timeout
- `verifySummary` state with `totalEntries`
- Video download: `URL.createObjectURL(videoBlob)`
- Certificate download: `generateCertificate()`

**Port from staging-final:**
- `CertificateModal` dialog component (the UI shell — content sections, layout, styling)
- "View Certificate" button that opens the modal
- Progress bar download UX (optional — staging-final fakes it at 10% increments)

- [ ] **Step 3: Add callbacks for "Create Another" flow**

The staging-final has `onCreateAnother` and `onGoHome`. The aws-liveness only has `onBack`. Add `onCreateAnother` support:

```jsx
// In App.jsx, the handler will be:
onCreateAnother={() => {
  setRecordingData(null);
  setSubcontractAddress(null);
  setFinalHash(null);
  setShowConsentModal(true);
  setCurrentScreen('demo'); // or wherever the flow restarts
}}
```

- [ ] **Step 4: Verify build**

Run: `npx vite build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/components/success-screen.jsx
git commit -m "feat: merge success-screen with staging-final certificate modal + real blockchain polling"
```

---

## Task 8: Merge upload-screen.jsx

**Strategy:** Use aws-liveness as base (has real file extraction + dual-callback), add staging-final's dev test mode selector.

**Files:**
- Modify: `frontend/src/app/components/upload-screen.jsx`

- [ ] **Step 1: Read both versions**

Read:
- `/Users/vaibhav/Downloads/BedRock-frontend-staging-final/src/app/components/upload-screen.jsx`
- `/Users/vaibhav/Downloads/BedRock-aws-liveness-integrated-tomain/frontend/src/app/components/upload-screen.jsx`

- [ ] **Step 2: Add staging-final's dev mode testing UI to the aws-liveness version**

The staging-final has a collapsible dev navigation panel (only visible when `import.meta.env.DEV`) that lets the developer select test modes:
- Random (70% pass)
- No Metadata
- Success (always pass)
- Failure (always fail)

Port this UI into the aws-liveness version as a dev-only feature. It should appear as a collapsible sidebar or section that's only rendered in development mode.

**Keep from aws-liveness:**
- Props: `{ onVerify, onNeedsAddress, onBack }`
- `onVerify(file, address, duration)` callback (real file + address)
- `onNeedsAddress(file, duration)` callback (no metadata found)
- `getVideoDuration(file)` helper function
- Real metadata extraction attempt
- Error handling for invalid files

**Port from staging-final:**
- Dev test mode selector UI (collapsible, `import.meta.env.DEV` guard)
- The dev panel's visual design (chip-style buttons, collapsible section)

**Note:** The Navbar call in this component currently passes `variant="light"`. Since Task 5 added backward-compat support for `variant` to the staging-final Navbar, this should work without changes.

- [ ] **Step 3: Verify build**

Run: `npx vite build`
Expected: Build succeeds. Dev panel is tree-shaken in production.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/components/upload-screen.jsx
git commit -m "feat: add dev test mode selector from staging-final to upload screen"
```

---

## Task 9: Merge verification-result.jsx

**Strategy:** Use aws-liveness as base (has real hash comparison + segment timeline + tampering details). Incorporate any visual polish from staging-final.

**Files:**
- Modify: `frontend/src/app/components/verification-result.jsx`

- [ ] **Step 1: Read both versions**

Read:
- `/Users/vaibhav/Downloads/BedRock-frontend-staging-final/src/app/components/verification-result.jsx`
- `/Users/vaibhav/Downloads/BedRock-aws-liveness-integrated-tomain/frontend/src/app/components/verification-result.jsx`

- [ ] **Step 2: Compare and enhance**

The aws-liveness version is functionally superior (real data: SegmentTimeline, divergence point, hash comparison, subcontract details). The staging-final version has simpler pass/fail UI with mock data.

**Keep from aws-liveness (everything):**
- Props: `{ result, onBack }` where result has `verified, calculatedFinalHash, onChainFinalHash, totalSegments, subcontractInfo, tampering`
- `SegmentTimeline` component (visual bar chart)
- Divergence details section
- Hash comparison at divergence
- Subcontract info section
- `ResultShell` wrapper component

**Port from staging-final:**
- "Verify Another" button (staging-final has `onVerifyAnother` — add as second callback)
- "Download Verification Certificate" button (add download functionality)
- Any visual polish (motion animations, card styling) that improves the UX

- [ ] **Step 3: Add onVerifyAnother callback**

Update the component to accept an optional `onVerifyAnother` prop and render a button for it alongside the existing "Back" button.

- [ ] **Step 4: Verify build**

Run: `npx vite build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/components/verification-result.jsx
git commit -m "feat: add verify-another button and visual polish to verification result"
```

---

## Task 10: Merge App.jsx — the orchestrator

**Strategy:** Combine staging-final's hash routing + new pages with aws-liveness's real backend handlers. This is the most complex task.

**Files:**
- Rewrite: `frontend/src/app/App.jsx`

- [ ] **Step 1: Read both App.jsx files again**

Read:
- `/Users/vaibhav/Downloads/BedRock-frontend-staging-final/src/app/App.jsx`
- `/Users/vaibhav/Downloads/BedRock-aws-liveness-integrated-tomain/frontend/src/app/App.jsx`

- [ ] **Step 2: Write the merged App.jsx**

The merged App.jsx must include:

**From staging-final:**
- Hash routing helpers: `getPage()`, `goToApp()`, `goToLanding()`
- `page` state: `'landing' | 'app'`
- `useEffect` for `hashchange` listener
- Landing page routing: `landing`, `instructions`, `faq`, `contact`
- `DemoScreen` as the app entry point
- `handleDemoClick`, `handleNavClick`, `handleBackToLanding`
- Imports: `DemoScreen`, `InstructionsPage`, `FaqPage`, `ContactPage`

**From aws-liveness:**
- All real state: `subcontractAddress`, `finalHash`, `uploadedFile`, `videoDuration`, `verificationResult`
- All real handlers:
  - `handleRecordingComplete(timestamp, duration, finalHashHex, videoBlob)` — receives real data
  - `handleUploadVerifyWithAddress(file, address, duration)` — real file + address
  - `handleUploadNeedsAddress(file, duration)` — no metadata fallback
  - `handleManualVerify(address)` — manual address entry
  - `handleVerificationComplete(result)` — API result
  - `handleVerificationError(error)` — API error
- All real screens:
  - `SetupLoadingScreen` with `onComplete` receiving `subcontractAddress`
  - `RecordingInterface` with `subcontractAddress`, `onComplete`, `onLivenessFail`
  - `LivenessFailedScreen` with retry logic
  - `VerificationLoading` with real API call
  - `VerificationResult` with real `result` object
- `ErrorBoundary` wrapper
- Imports: `RecordingInterface`, `LivenessFailedScreen`, `VerificationLoading`, `ErrorBoundary`

**REMOVE from aws-liveness App.jsx (no longer needed):**
- `import { AboutPage }` — replaced by Instructions/FAQ/Contact pages
- `import { NavItemKey }` — staging-final Navbar does not export this
- `import { LivenessVerification }` — NOT used; the aws-liveness `RecordingInterface` already handles liveness internally via AWS Rekognition FaceLivenessDetector. Do NOT add the staging-final's `LivenessVerification` screen to the merged flow.
- The `about` screen case and `handleNavItemSelect` handler (replaced by staging-final's `handleNavClick`)

**New additions for merge:**
- `consentOrigin` state from staging-final (tracks where consent was triggered)
- `handleConsentDeny` should navigate to `consentOrigin` (staging-final pattern: `setCurrentScreen(consentOrigin)`) rather than just closing modals
- `onCreateAnother` handler in success screen

**Screen flow after merge:**
```
Landing Page (hash: #/)
  ├── Instructions (hash: #/)
  ├── FAQ (hash: #/)
  └── Contact (hash: #/)

App (hash: #/app)
  ├── Demo Screen (entry point)
  │   ├── Create Video → Consent → Warning → Setup Loading → Recording → Success
  │   └── Verify Video → Upload → (Manual Fallback?) → Verification Loading → Result
  ├── Recording flow (real AWS + blockchain)
  └── Verification flow (real API)
```

**Key prop adaptations:**
- Landing page: `onDemoClick` triggers `goToApp()` + `setCurrentScreen('demo')`
- Demo screen: `onCreateVideo` opens consent modal, `onVerifyVideo` goes to upload
- Setup loading: `onComplete` receives `subcontractAddress` from real deploy API
- Recording interface: receives `subcontractAddress`, returns real `finalHashHex` + `videoBlob`
- Success screen: receives `videoBlob`, `subcontractAddress`, `finalHash` for real downloads + polling

- [ ] **Step 3: Wire up the staging-final navbar props**

The staging-final navbar expects `{ onLogoClick, onDemoClick, onNavClick, currentScreen, disabled, inApp }`. Ensure:
- `onLogoClick` → `handleBackToLanding`
- `onDemoClick` → `handleDemoClick`
- `onNavClick` → `handleNavClick` (sets landing page section)
- `currentScreen` → current screen name
- `inApp` → `page === 'app'`

For screens that render their own Navbar (like recording-interface.jsx), check what props it passes and ensure compatibility. The recording-interface likely passes `variant="light"` or similar — add a shim if the staging-final Navbar doesn't support this prop.

- [ ] **Step 4: Verify build**

Run: `npx vite build`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/App.jsx
git commit -m "feat: merge App.jsx with hash routing, new pages, and real backend integration"
```

---

## Task 11: Full build verification and smoke test

**Files:** None (verification only)

- [ ] **Step 1: Clean build**

```bash
cd /Users/vaibhav/Downloads/BedRock-aws-liveness-integrated-tomain/frontend
rm -rf dist node_modules/.vite
npx vite build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Check for broken imports**

```bash
npx vite build 2>&1 | grep -i "error\|Could not resolve\|not found"
```

Expected: No import resolution errors.

- [ ] **Step 3: Start dev server and verify rendering**

```bash
cd /Users/vaibhav/Downloads/BedRock-aws-liveness-integrated-tomain/frontend
npx vite --port 5173 &
```

Open `http://localhost:5173` in browser. Verify:
- Landing page renders with rich UI (hero, How It Works, Audience, Footer)
- Instructions/FAQ/Contact pages accessible from navbar
- "Launch App" → Demo screen renders with Record/Verify cards
- Record flow: Consent → Warning → Setup Loading (will fail without backend, but should render)
- Verify flow: Upload screen renders with drag-drop zone

- [ ] **Step 4: Run backend tests to confirm nothing broke**

```bash
cd /Users/vaibhav/Downloads/BedRock-aws-liveness-integrated-tomain/backend
npm test
```

Expected: Same test results as before (48 passed, 2 integration tests fail without running server — unchanged).

- [ ] **Step 5: Final commit (if any remaining unstaged changes)**

```bash
git status
# Only stage frontend files — verify no secrets or node_modules are included
git add frontend/
git commit -m "chore: verify full frontend integration build"
```

---

## Integration Notes

### Prop signature mapping between staging-final → aws-liveness

| Component | staging-final props | aws-liveness props | Adaptation |
|-----------|--------------------|--------------------|------------|
| LandingPage | `onDemoClick, onNavClick, currentScreen` | `onCreateVideo, onVerifyVideo, onNavItemSelect` | Use staging-final names |
| Navbar | `onLogoClick, onDemoClick, onNavClick, currentScreen, disabled, inApp` | `variant, activeItem, onNavItemSelect, onLogoClick, disabled` | Add compatibility |
| SetupLoadingScreen | `onComplete()` (no args) | `onComplete(subcontractAddress)` | Use aws-liveness callback signature |
| SuccessScreen | `timestamp, duration, onCreateAnother, onGoHome` | `timestamp, duration, videoBlob, subcontractAddress, finalHash, onBack` | Superset of both |
| UploadScreen | `onVerify(hasMetadata, mode), onBack` | `onVerify(file, addr, dur), onNeedsAddress(file, dur), onBack` | Use aws-liveness callback signatures |
| VerificationResult | `isVerified, timestamp, onVerifyAnother, onGoHome` | `result, onBack` | Use aws-liveness result object |
| RecordingInterface | `onComplete(timestamp, duration)` | `subcontractAddress, onComplete(ts, dur, hash, blob), onLivenessFail` | Use aws-liveness — this component is NOT replaced |

### What NOT to touch
- `src/lib/*` — All utility modules stay from aws-liveness
- `src/styles/aws-liveness.css` — AWS component overrides stay
- `src/app/components/recording-interface.jsx` — Real AWS Liveness integration stays
- `src/app/components/liveness-failed-screen.jsx` — Stays
- `src/app/components/verification-loading.jsx` — Stays
- `src/app/components/error-boundary.jsx` — Stays
- Backend code — Not touched at all
