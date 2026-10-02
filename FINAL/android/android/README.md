# Bedrock Android App

Companion Android app (`com.bedrock.app`) for the Bedrock liveness-gated video evidence system. Captures video on device and anchors a rolling SHA-256 hash chain on the Stability Protocol (ZGT) blockchain via the same `Grandfather` contract used by the web app.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Android Studio | Ladybug (2024.2) or newer |
| Android SDK | API 34+ (compile), API 26+ (min) |
| JDK | 17 |
| Gradle | 8.11.1 (wrapper handles this) |
| Device / Emulator | Android 8.0+ (API 26), camera required |

---

## 1. Configure secrets (`local.properties`)

All blockchain secrets live in `android/local.properties`. **This file is in `.gitignore` and must never be committed.**

Create or edit `android/local.properties` and add the following block beneath the `sdk.dir` line:

```properties
sdk.dir=/Users/<you>/Library/Android/sdk

# --- Bedrock blockchain config (do NOT commit) ---

# Stability Protocol RPC endpoint. Pick ONE network at a time.
# Mainnet:
# RPC_URL=https://rpc.stabilityprotocol.com/zgt/<your-mainnet-api-key>
# Testnet:
RPC_URL=https://rpc.testnet.stabilityprotocol.com/zgt/<your-testnet-api-key>

# Wallet private key used to sign on-chain trail writes.
# 64 hex chars, prefixed with 0x. Fund this wallet with ZGT before deploying.
PRIVATE_KEY=0x<your-64-char-hex-private-key>

# Grandfather contract address (shared across web + Android — same deployment).
# Mainnet:
# GRANDFATHER_ADDRESS=0x76317dD8b5A390c6876F3a94A07230654b476E19
# Testnet:
GRANDFATHER_ADDRESS=0x66a1d75114Db005C7DcAc0e9A6600b1aca02eE6A

# Segment size in bytes for the rolling hash chain. Must match backend SEG_SIZE_BYTES.
SEG_SIZE_BYTES=1310720
```

### Network switching

The mainnet and testnet `RPC_URL` / `GRANDFATHER_ADDRESS` pairs are **fixed and shared with the web/backend deployment**. To switch networks, comment one pair and uncomment the other — do not mix mainnet RPC with testnet contract or vice versa.

### Where these values are read

`local.properties` is parsed at build time and the values are injected into `BuildConfig` so the app code reads them at runtime via `BuildConfig.RPC_URL`, `BuildConfig.PRIVATE_KEY`, etc. Nothing is hard-coded in source.

### Generating a fresh wallet

If you need a new signing wallet (e.g. for a per-developer testnet key):

```bash
# Using web3 / ethers in Node:
node -e "console.log(require('ethers').Wallet.createRandom().privateKey)"
```

Fund the resulting address with testnet ZGT from the Stability faucet before running the app.

### Rotating a leaked key

1. Move any remaining funds out of the compromised wallet.
2. Generate a new key (above), update `PRIVATE_KEY` in `local.properties`.
3. Rebuild and reinstall the app.
4. The `Grandfather` contract address does **not** change — only the signing wallet.

---

## 2. First-time setup from scratch

```bash
# 1. Clone
git clone <repo-url> BedRock
cd BedRock/android

# 2. Open in Android Studio
#    File → Open → select the `android/` directory.
#    Let Gradle sync finish (downloads SDK components on first run).

# 3. Create local.properties with the block from section 1.

# 4. Confirm the device/emulator is API 26+ and has a camera.

# 5. Build & run
./gradlew assembleDebug
./gradlew installDebug    # installs onto the connected device
```

If you don't have the Gradle wrapper yet (fresh checkout missing `gradlew`):

```bash
gradle wrapper --gradle-version 8.11.1
```

### Troubleshooting first build

- **`SDK location not found`** — `sdk.dir` in `local.properties` is wrong. Point it at your local Android SDK (`~/Library/Android/sdk` on macOS).
- **`PRIVATE_KEY` missing at runtime** — `local.properties` was not present at build time. Rebuild after adding it; `BuildConfig` is regenerated from `local.properties`.
- **`insufficient funds for gas`** — the wallet behind `PRIVATE_KEY` has no ZGT. Fund it from the faucet (testnet) or transfer ZGT (mainnet).
- **`could not detect network`** — `RPC_URL` is unreachable or has the wrong API key suffix. Test it with `curl <RPC_URL>` and a basic JSON-RPC payload.

---

## 3. Deploying from scratch

### Debug build (development / sideload)

```bash
cd android
./gradlew clean assembleDebug
# APK lands at:
# app/build/outputs/apk/debug/app-debug.apk

# Install over USB:
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

### Release build (signed APK / AAB)

1. **Generate a release keystore** (one-time, store securely — losing it means you can't ship updates):

   ```bash
   keytool -genkey -v \
     -keystore ~/keystores/bedrock-release.jks \
     -keyalg RSA -keysize 2048 -validity 10000 \
     -alias bedrock
   ```

2. **Add keystore credentials to `local.properties`** (still uncommitted):

   ```properties
   RELEASE_STORE_FILE=/Users/<you>/keystores/bedrock-release.jks
   RELEASE_STORE_PASSWORD=<store-password>
   RELEASE_KEY_ALIAS=bedrock
   RELEASE_KEY_PASSWORD=<key-password>
   ```

3. **Build**:

   ```bash
   ./gradlew clean assembleRelease       # signed APK
   ./gradlew bundleRelease               # AAB for Play Store

   # Outputs:
   # app/build/outputs/apk/release/app-release.apk
   # app/build/outputs/bundle/release/app-release.aab
   ```

4. **Verify the signature**:

   ```bash
   $ANDROID_HOME/build-tools/<ver>/apksigner verify --print-certs \
     app/build/outputs/apk/release/app-release.apk
   ```

5. **Distribute**: upload the `.aab` to Google Play Console, or distribute the `.apk` directly. Make sure the release build was produced against the **mainnet** `RPC_URL` + `GRANDFATHER_ADDRESS` if shipping to production users.

### Network checklist before a production release

- [ ] `RPC_URL` is the mainnet endpoint (commented testnet line).
- [ ] `GRANDFATHER_ADDRESS=0x76317dD8b5A390c6876F3a94A07230654b476E19` (mainnet).
- [ ] `PRIVATE_KEY` is the production signing wallet, funded with ZGT.
- [ ] `SEG_SIZE_BYTES=1310720` matches backend.
- [ ] `versionCode` / `versionName` in `app/build.gradle` bumped.
- [ ] Release keystore is the same one used for prior published versions (Play Store rejects mismatched signatures).

---

## 4. Files & directories

```
android/
├── README.md              ← this file
├── local.properties       ← secrets, gitignored
├── build.gradle(.kts)     ← root Gradle config
├── settings.gradle(.kts)  ← module list
├── gradle.properties
├── gradlew, gradle/       ← Gradle wrapper
└── app/
    ├── build.gradle(.kts) ← app module: deps, signingConfigs, BuildConfig fields
    └── src/main/
        ├── AndroidManifest.xml
        ├── kotlin/com/bedrock/app/...
        └── res/
```

## 5. Security notes

- `local.properties` is the **only** place the private key lives in the repo workspace. It is gitignored — confirm with `git check-ignore -v android/local.properties` before any commit.
- Do not paste the private key into commit messages, issues, screenshots, or logs.
- The signing wallet is recoverable from chain history but its key is not — back up `PRIVATE_KEY` separately (1Password / hardware vault).
- Release keystore (`bedrock-release.jks`) is irrecoverable if lost. Back it up alongside the wallet key.
