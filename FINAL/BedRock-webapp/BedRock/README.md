# Bedrock -- Liveness-Gated Video Evidence on Blockchain

Browser-based application that captures liveness-verified video recordings and anchors a rolling SHA-256 hash chain on the Stability Protocol (ZGT) blockchain. Includes a full verification module that can detect tampering down to the exact segment and approximate second.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20+ | Required for both frontend and backend |
| npm | 9+ | Comes with Node 20 |
| Docker | Any | For Redis (or install Redis natively) |
| Chrome/Edge/Firefox | Modern | WebM MediaRecorder support required |
| Python | 3.8+ | Only for offline `rehash.py` tool |

---

## Quick Start

### 1. Clone & install dependencies

```bash
git clone <repo-url> BedRock
cd BedRock
npm install        # installs both frontend and backend workspaces
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your actual values (see Environment Variables below)

cp frontend/.env.example frontend/.env
# Edit frontend/.env with your AWS region + Cognito Identity Pool ID
```

### 3. Run (development -- 3 terminals)

**Terminal 1 -- Redis**
```bash
docker-compose up redis
```

**Terminal 2 -- Backend** (port 3001)
```bash
cd backend && npm run dev
```

**Terminal 3 -- Frontend** (port 5173)
```bash
cd frontend && npm run dev
```

Open **http://localhost:5173** in a supported browser.

### 4. Run (production -- Docker Compose)

```bash
docker-compose up --build
```

This builds the multi-stage Docker image (frontend Vite build + Node backend) and serves everything on port 3001.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Backend server port | `3001` |
| `REDIS_URL` | Redis connection string (supports `redis://` and `rediss://` TLS) | `redis://localhost:6379` |
| `AWS_REGION` | AWS region for Rekognition FaceLiveness | `ap-south-1` |
| `AWS_ACCESS_KEY_ID` | AWS IAM access key ID | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret access key | `abc123...` |
| `LIVENESS_THRESHOLD` | Minimum confidence score to pass liveness (0--100) | `90` |
| `PRIVATE_KEY` | Wallet private key for signing blockchain transactions | `your-private-key` |
| `GRANDFATHER_ADDRESS` | Grandfather factory contract address on Stability Protocol | `0x...` |
| `RPC_URL` | Stability Protocol RPC base URL | `https://rpc.stabilityprotocol.com` |
| `API_KEY` | ZGT API key (appended as `/zgt/<key>` to RPC_URL) | `your-api-key` |
| `SEG_SIZE_BYTES` | Segment size for rolling hash chain (must match frontend) | `1310720` |
| `HASH_JOB_TIMEOUT_MS` | BullMQ job timeout in milliseconds | `30000` |
| `HASH_JOB_RETRIES` | Max retry attempts before dead-letter | `5` |
| `HASH_CONCURRENCY` | BullMQ worker concurrency (keep at 1 for sequential delivery) | `1` |

### Frontend (`frontend/.env`)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_AWS_REGION` | AWS region (must match backend) | `ap-south-1` |
| `VITE_COGNITO_IDENTITY_POOL_ID` | AWS Cognito Identity Pool ID for unauthenticated Rekognition access | `ap-south-1:xxxx-xxxx` |
| `VITE_SEG_SIZE_BYTES` | Segment size (must match backend `SEG_SIZE_BYTES`) | `1310720` |

---

## Architecture

### Application Flow

```
Landing Page (/#/)
    |
    +-- Instructions Page
    +-- FAQ Page
    +-- Contact Page
    |
    +-- Demo Screen (/#/app)
            |
            +------- Create Video --------+
            |                             |
            |   Consent Modal             |
            |       |                     |
            |   No Turning Back Modal     |
            |       |                     |
            |   Setup Loading Screen      |
            |       | POST /api/subcontract/deploy
            |       | (deploys Subcontract via Grandfather factory)
            |       |
            |   Recording Interface       |
            |       | Dual-stream: recording stream + AWS liveness stream
            |       | AWS Rekognition FaceLiveness challenge
            |       |   POST /api/liveness/session (create)
            |       |   GET  /api/liveness/session/:id/result (poll)
            |       | Phase: LIVENESS_PENDING -> LIVE_HASHING
            |       | Rolling SHA-256 hash chain (1.25 MB segments)
            |       | POST /api/hashes/submit (batch, after recording stops)
            |       |
            |   Success Screen
            |       | Download video (.webm)
            |       | Download/View Proof-of-Integrity Certificate (PDF)
            |       | Create Another Video
            |
            +------- Verify Video --------+
                                          |
                Upload Screen             |
                    | Drag-and-drop or file select
                    | Auto-resolves subcontract from video's genesis hash
                    |
                Verification Loading      |
                    | POST /api/verify (multipart upload)
                    | Phase animation: upload -> hash -> read chain -> compare
                    |
                Verification Result
                    | VERIFIED: all segments match
                    | TAMPERED: divergence point + segment timeline + video preview
                    | NOT FOUND: no blockchain record for this video
```

### AWS Rekognition FaceLiveness Integration

Liveness detection uses **AWS Rekognition FaceLiveness** via the `@aws-amplify/ui-react-liveness` `FaceLivenessDetector` component. AWS Cognito Identity Pool provides unauthenticated credentials so the browser can communicate directly with AWS during the challenge.

**Flow:**

1. `RecordingInterface` mounts and starts a dual camera stream (one for MediaRecorder, one for the AWS liveness widget)
2. Backend creates a FaceLiveness session: `POST /api/liveness/session` calls `CreateFaceLivenessSessionCommand` with `FaceMovementAndLightChallenge`
3. Frontend renders `FaceLivenessDetector` which guides the user through the active liveness challenge (head movement + color flashing)
4. On `onAnalysisComplete`: frontend polls `GET /api/liveness/session/:id/result` which calls `GetFaceLivenessSessionResultsCommand`
5. On **pass** (confidence >= `LIVENESS_THRESHOLD`, default 90): `notifyLivenessPassed()` is called, buffered hash records are committed, recording continues in `LIVE_HASHING` phase
6. On **fail**: `notifyLivenessFailed()` discards all buffered data, user is redirected to `LivenessFailedScreen` with a retry option (new Subcontract deployed)

All liveness challenge logic runs server-side on AWS -- no frames are processed locally.

> **Note:** A deprecated Luxand.cloud fallback endpoint (`POST /api/luxand/liveness`) still exists in the backend but is not used by the frontend.

### Backend Services

```
Express (port 3001)
    +-- POST /api/liveness/session             -> CreateFaceLivenessSessionCommand
    +-- GET  /api/liveness/session/:id/result  -> GetFaceLivenessSessionResultsCommand
    +-- POST /api/hashes/submit                -> enqueue hash jobs to BullMQ
    +-- POST /api/subcontract/deploy           -> deploy Subcontract via Grandfather
    +-- GET  /api/subcontract/:addr/status     -> poll Redis for verification state
    +-- POST /api/verify                       -> full video re-hash + on-chain comparison
    +-- POST /api/luxand/liveness              -> (deprecated) Luxand.cloud fallback

BullMQ Worker (concurrency=1, non-retryable)
    +-- blockchain-writer.js
            +-- staticCall preflight (simulate tx)
            +-- addCumulativeHash(hash, isFinal, isFirst)
            +-- awaitReceipt + validate HashRecorded event
            +-- if isFirst: cache Initialized event data in Redis
            +-- if isFinal: write verify:<addr>={status:'complete'} to Redis
```

---

## How the Hash Chain Works

```
SEG_SIZE = 1.25 MB (1,310,720 bytes) -- configurable via SEG_SIZE_BYTES

segHash_i = SHA-256( zeroPad(segmentBytes_i, SEG_SIZE) )
roll_0    = SHA-256( segHash_0 )                          <- genesis
roll_i    = SHA-256( roll_{i-1} || segHash_i )            <- subsequent
```

- The genesis segment always covers bytes `0` to `SEG_SIZE` of the recording file
- Zero-padding ensures every segment is exactly `SEG_SIZE` bytes before hashing
- The chain is deterministically re-verifiable from the raw file alone -- no metadata needed
- During recording, hash records are buffered during `LIVENESS_PENDING` phase and only committed once liveness passes
- All hashes are submitted in a single batch via `POST /api/hashes/submit` after recording stops
- The last segment is marked `isFinalHash: true`

---

## Verify Module -- Zero-Knowledge Discovery Flow

The verification system allows anyone to check a video's integrity without needing to know the subcontract address in advance. The video's own bytes are its identity.

### Phase 1: Subcontract Resolution (Zero-Knowledge Discovery)

```
Upload video file
    |
    v
computeFirstHash(fileBuffer)
    | Read first SEG_SIZE bytes of file
    | segHash_0 = SHA-256(zeroPad(segment_0, SEG_SIZE))
    | roll_0 = SHA-256(segHash_0)                       <- genesis hash
    |
    v
resolveSubcontract(grandfather, roll_0)
    | Grandfather.getSubcontractByFirstHash(0x + roll_0)
    | Returns subcontract address or address(0) if not found
```

The genesis hash (`roll_0`) is the fingerprint of the first 1.25 MB of the recording. The Grandfather contract maintains a reverse lookup mapping `firstHash -> subcontractAddress`, populated automatically when the first hash is written on-chain.

### Phase 2: On-Chain Trail Reading

```
readOnChainTrail(subcontract, grandfather)
    | 1. Verify isAuthorizedChild via Grandfather
    | 2. Read state: owner, totalEntries, isInitialized, isFinalized, deploymentBlock
    | 3. Read registry: firstHash, finalHash from Grandfather.registry(address)
    | 4. Query all HashRecorded events from deploymentBlock (paginated, 25K block chunks)
    | 5. Retry up to 10x with exponential backoff if event count < totalEntries
    |    (Stability RPC has eventually-consistent event indexing)
    | 6. Sort trail by sequence number
```

### Phase 3: Hash Comparison

```
compareHashTrails(calculatedRecords, onChainTrail)
    | Walk position-by-position:
    |   normalize(calculated[i].rollingHex) vs normalize(onChain[i].newHash)
    |
    +-- All match + same length -> VERIFIED
    +-- Divergence found        -> TAMPERED (divergenceSegmentIndex, byteOffset, ~second)
    +-- No on-chain record      -> NOT FOUND (hint: first segment may be modified)
```

### Three End States

| State | Condition | UI |
|-------|-----------|-----|
| **Verified** | All segments match, lengths equal | Green shield, "Video is Authentic", technical details accordion |
| **Tampered** | Divergence at segment `i` | Red X, segment timeline visualization, tampered segment video preview, divergence details (segment index, byte offset, time window) |
| **Not Found** | `getSubcontractByFirstHash` returns address(0) | Warning icon, possible causes explanation (first segment modified or chain still writing) |

When tampering is detected, the UI shows:
- A **segment timeline bar** with green (verified), red (tampered), and faded-red (cascade-affected) segments
- A **clickable video preview** that plays only the tampered segment (from `segmentStartSecond` to `segmentEndSecond`)
- **Technical details** accordion with divergence point, byte offset, approximate time, and side-by-side hash comparison

---

## Proof-of-Integrity Certificate (PDF)

Generated client-side using `html2canvas` + `jsPDF`. Available on the Success Screen after recording.

**Fields included:**

| Field | Description |
|-------|-------------|
| Bedrock logo | 3D cube SVG mark + "Bedrock." wordmark |
| Title | "Proof-of-Integrity Certificate" |
| Date & Time | Recording timestamp |
| Duration | Recording duration in seconds |
| Subcontract Address | On-chain contract address (monospace, word-break) |
| Final Rolling Hash | Last rolling hash in the chain (monospace, word-break) |
| Verification badge | "Blockchain-verified integrity -- tamper-evident record" |
| Footer | Generation date + "bedrock.evidence" |

Format: A4 portrait, dark theme (`#0c0a13` background), rendered at 2x scale for crisp text, output as JPEG-in-PDF.

---

## Blockchain: Stability Protocol (ZGT)

- **Gasless**: all transactions use `maxFeePerGas = 0`, `maxPriorityFeePerGas = 0`
- **RPC URL**: `https://rpc.stabilityprotocol.com/zgt/<API_KEY>`
- **Grandfather contract**: factory and registry that deploys per-recording Subcontracts
  - `createSubcontract()` -> deploys a new Subcontract, emits `SubcontractCreated`
  - `registry(address)` -> returns `(firstHash, finalHash)` for a subcontract
  - `getSubcontractByFirstHash(bytes32)` -> reverse lookup for verification
  - `getSubcontractByFinalHash(bytes32)` -> reverse lookup by final hash
  - `isAuthorizedChild(address)` -> validates subcontract legitimacy
- **Subcontract**: per-recording hash vault
  - `addCumulativeHash(bytes32, isFinal, isFirst)` -> stores a rolling hash entry
  - Emits `HashRecorded(previousHash, newHash, sequence)` on each write
  - Emits `Initialized(firstHash)` on first write, `Finalized(finalHash)` on last
  - State: `owner`, `grandfather`, `deploymentBlock`, `totalEntries`, `isInitialized`, `isFinalized`
- **Non-retryable jobs**: BullMQ `attempts=1` -- no on-chain duplicate guard exists, so each job runs exactly once

---

## Deployment

### Google Cloud Run (Production)

The project deploys via **Google Cloud Build** (`cloudbuild.yaml`) or the `scripts/deploy.sh` script:

1. Multi-stage Docker build: frontend Vite bundle + backend Node.js
2. Push to **Artifact Registry** (`asia-south1-docker.pkg.dev`)
3. Deploy to **Cloud Run** (`asia-south1` region)
   - 4 GiB memory, 2 vCPU
   - Min 1 / Max 10 instances, concurrency 10
   - 1-hour request timeout
   - Unauthenticated access allowed

**Redis**: Upstash serverless Redis (TLS via `rediss://` URL).

Build-time env vars (`VITE_*`) are baked into the frontend bundle. Runtime env vars are injected via Cloud Run `--set-env-vars`.

### Docker Compose (Local)

```bash
docker-compose up --build
```

Runs the app container (port 3001) + Redis 7 Alpine with AOF persistence.

---

## Offline Verification (`tools/rehash.py`)

Recomputes the rolling hash chain from a local recording file for manual comparison against on-chain data.

```bash
cd tools
python rehash.py <recording.webm>

# With custom segment size:
SEG_SIZE_BYTES=1310720 python rehash.py <recording.webm>
```

The script:
1. Reads the recording as raw bytes
2. Splits into `SEG_SIZE` chunks (zero-pads the last one)
3. Computes `segHash_i = SHA-256(padded_chunk_i)` for each segment
4. Computes rolling chain: `roll_0 = SHA-256(segHash_0)`, `roll_i = SHA-256(roll_{i-1} || segHash_i)`
5. Prints all segment hashes and rolling hashes for manual comparison

---

## API Endpoints

### Liveness

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/liveness/session` | Create AWS Rekognition FaceLiveness session. Returns `{ sessionId }` |
| `GET` | `/api/liveness/session/:sessionId/result` | Poll liveness result. Returns `{ sessionId, status, confidence, threshold, isLive, isTerminal, hasReferenceImage, hasAuditImages }` |

### Hash Chain

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/hashes/submit` | Submit hash records for blockchain writing. Body: `{ recordingId, subcontractAddress, hashes[] }`. Returns `{ queued, jobIds[] }` |

### Subcontract

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/subcontract/deploy` | Deploy a new Subcontract via Grandfather factory. Returns `{ subcontractAddress, deploymentBlock, signerEoa }` |
| `GET` | `/api/subcontract/:address/status` | Poll verification status. Returns `{ status: 'not_started' | 'pending' | 'complete' | 'error' }` |

### Verification

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/verify` | Verify video integrity (multipart). Fields: `file` (video), `subcontractAddress` (optional, auto-resolved), `videoDurationSeconds` (optional). Returns verification result with `verified`, `tampering`, `subcontractInfo` |

### Legacy (Deprecated)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/luxand/liveness` | Luxand.cloud liveness proxy (deprecated, kept as fallback). Body: `{ imageBase64 }` |

---

## Project Structure

```
BedRock/
  frontend/                          <- Vite + React 18 + MUI 7 + Tailwind CSS 4
    src/
      app/
        App.jsx                      <- Screen state machine + hash routing (/#/ and /#/app)
        components/
          landing-page.jsx           <- Marketing landing page
          instructions-page.jsx      <- How-it-works page
          faq-page.jsx               <- FAQ page
          contact-page.jsx           <- Contact form (EmailJS)
          demo-screen.jsx            <- Create Video / Verify Video entry point
          consent-modal.jsx          <- Recording consent dialog
          no-turning-back-modal.jsx  <- Final confirmation before recording
          setup-loading-screen.jsx   <- Deploys Subcontract + loading animation
          recording-interface.jsx    <- AWS FaceLiveness + dual-stream recording + hashing
          liveness-failed-screen.jsx <- Liveness failure with retry option
          success-screen.jsx         <- Download video/certificate, blockchain status
          upload-screen.jsx          <- Drag-and-drop video upload for verification
          manual-fallback-modal.jsx  <- Manual subcontract address entry
          verification-loading.jsx   <- 4-phase verification progress animation
          verification-result.jsx    <- Verified/Tampered/Error result display
          navbar.jsx                 <- Navigation bar
          logo.jsx                   <- Bedrock logo component
          rotating-text.jsx          <- Animated text component
          dotted-surface.jsx         <- Background decoration
          error-boundary.jsx         <- React error boundary
          ui/                        <- shadcn/ui primitives (Radix-based)
      lib/
        hashing.js                   <- SHA-256 + rolling hash (WebCrypto, browser-side)
        recording.js                 <- MediaRecorder pipeline + liveness-gated hash chain
        api.js                       <- Backend API client with timeout handling
        certificate.js               <- Proof-of-Integrity PDF generator (html2canvas + jsPDF)
      imports/
        LogoAssets.jsx               <- Logo SVG components
        Technology.json              <- Technology stack data
        svg-*.js/jsx                 <- Inline SVG assets
      styles/
        aws-liveness.css             <- AWS FaceLivenessDetector style overrides
        fonts.css                    <- Custom font declarations
        index.css                    <- Global styles
        tailwind.css                 <- Tailwind entry point
        theme.css                    <- CSS custom properties
      main.jsx                       <- React entry point (Amplify.configure for Cognito)
      theme.js                       <- MUI theme + brand color tokens
    guidelines/
      Guidelines.md                  <- Frontend development guidelines
    index.html                       <- SPA shell
    vite.config.js                   <- Vite config (proxy /api -> localhost:3001, @ alias)
    postcss.config.mjs               <- PostCSS config
    .env.example                     <- Frontend env template
    package.json

  backend/                           <- Express + BullMQ + ethers.js v6
    src/
      index.js                       <- Express API server + Redis client + route handlers
      queue.js                       <- BullMQ queue + worker (concurrency=1, non-retryable)
      blockchain-writer.js           <- On-chain hash submission (staticCall -> tx -> receipt)
      smartcontract/
        abi.js                       <- Grandfather + Subcontract ABI definitions
        GrandfatherService.js        <- createSubcontract, extractSubcontractAddress
        SubcontractService.js        <- addCumulativeHash, getCumulativeHashSummary
        ZgtEthersFactory.js          <- ethers.js provider/signer/contract builders
        ZgtContextService.js         <- Cached ethers context (provider + signer + grandfather)
        ReceiptService.js            <- Transaction receipt polling with timeout
        RetryLogicService.js         <- Exponential backoff retry wrapper
      verification/
        verify.js                    <- Verification orchestrator (4 phases)
        video-hasher.js              <- File buffer -> rolling hash chain
        hashing.js                   <- SHA-256 + rolling update (Node.js crypto)
        chain-reader.js              <- On-chain HashRecorded event reader
        comparator.js                <- Hash trail comparison + tamper detection
        subcontract-resolver.js      <- Genesis hash -> subcontract address lookup
    tests/
      blockchain-writer-cache.test.js
      retry-logic.test.js
      integration/
        direct-verify.test.js
        e2e-verify.test.js
      verification/
        chain-reader.test.js
        comparator.test.js
        hashing.test.js
        hashing-config.test.js
        subcontract-resolver.test.js
        verify.test.js
        video-hasher.test.js
    vitest.config.js                 <- Vitest test runner config
    .env.example                     <- Backend env template
    package.json

  tools/
    rehash.py                        <- Offline recording hash verifier (Python)

  brand-guide/
    Bedrock Brand Guide.html         <- Brand identity guide

  docs/
    verification-flow-drawio.xml     <- Verification flow diagram (draw.io)
    verification-flow-overview.xml   <- High-level flow diagram
    verification-highlevel-drawio.xml
    verification-lowlevel-drawio.xml
    superpowers/plans/               <- Development planning docs

  scripts/
    deploy.sh                        <- Google Cloud Run deployment script

  Dockerfile                         <- Multi-stage build (frontend + backend)
  docker-compose.yml                 <- App + Redis services
  cloudbuild.yaml                    <- Google Cloud Build CI/CD pipeline
  package.json                       <- npm workspaces root
  package-lock.json
  .gitignore
  .dockerignore
  README.md
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite 6, Material UI 7, Tailwind CSS 4, Framer Motion |
| Liveness | AWS Rekognition FaceLiveness, @aws-amplify/ui-react-liveness |
| Auth (Liveness) | AWS Cognito Identity Pool (unauthenticated access for Rekognition) |
| Hashing (browser) | WebCrypto `crypto.subtle.digest("SHA-256")` |
| Hashing (server) | Node.js `crypto.createHash("sha256")` |
| PDF Generation | html2canvas + jsPDF (client-side) |
| Backend | Express 4, Node.js 20, ES modules |
| Job Queue | BullMQ (Redis-backed, concurrency=1) |
| Blockchain | ethers.js v6, Stability Protocol (ZGT), gasless transactions |
| Cache/State | Redis (ioredis) -- deployment metadata, verification status |
| Testing | Vitest |
| Deployment | Docker, Google Cloud Build, Cloud Run, Upstash Redis |

---

## Development Notes

- Re-recording requires a **page refresh** -- each `RecordingInterface` mount is a fresh Recorder session
- Liveness fail redirects to `LivenessFailedScreen` with a retry option that deploys a new Subcontract
- The `FaceLivenessDetector` uses `FaceMovementAndLightChallenge` -- the user must move their head while color flashes verify depth
- Canvas stroke patches suppress Amplify's default freshness oval rendering to match the Bedrock UI
- Tailwind's `[hidden]` rule conflicts with Amplify's canvas toggling -- a MutationObserver strips the `hidden` attribute
- Frontend and backend `SEG_SIZE_BYTES` **must match** or verification will fail
- BullMQ jobs are non-retryable (`attempts=1`) because there is no on-chain duplicate guard
- The Vite dev server proxies `/api` requests to `localhost:3001`
- In production, the Express server serves the frontend static files from `frontend/dist` with SPA fallback
- Redis keys: `deploy:<address>` (deployment metadata, 7-day TTL), `verify:<address>` (verification status)
