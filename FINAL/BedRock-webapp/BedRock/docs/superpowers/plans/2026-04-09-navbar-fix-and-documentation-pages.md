# Navbar Color Fix + Documentation & Platforms Pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the navbar/text color bug (black text on dark backgrounds, white navbar flash) and add two new pages: a Documentation page (technical whitepaper-style content with flowchart diagrams) and a Platforms page (Raspberry Pi, Android APK, Web App).

**Architecture:** Both new pages follow the same component pattern as instructions-page.jsx / faq-page.jsx: a standalone component with Navbar, FadeUp animations, and MUI + brand tokens. They integrate into the existing hash-router in App.jsx via the `currentScreen` state. Flowchart and platform images are served from `frontend/public/images/`. The navbar fix addresses MUI theme defaults bleeding dark text colors into dark-surfaced components.

**Tech Stack:** React 18, MUI 7, motion/react, Lucide icons, Vite (static assets via `public/`)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `frontend/src/theme.js` | Fix MUI theme defaults for dark surfaces (Paper bg, text colors, Select menu) |
| Modify | `frontend/src/app/components/contact-page.jsx` | Fix Select MenuItem text color for dark theme |
| Modify | `frontend/src/app/components/navbar.jsx` | Add "Documentation" and "Platforms" nav items |
| Create | `frontend/public/images/flowchart-recording.png` | Recording module flowchart (copy from `flowchart(2).png`) |
| Create | `frontend/public/images/flowchart-liveness.png` | Liveness flow diagram (copy from `flowchart(4).png`) |
| Create | `frontend/public/images/flowchart-hashing.png` | Hashing algorithm diagram (copy from `flowchart(3).png`) |
| Create | `frontend/public/images/flowchart-verification.png` | Verification flow diagram (copy from `flowchart(1).png`) |
| Create | `frontend/public/images/raspberry-pi-1.png` | Raspberry Pi photo 1 |
| Create | `frontend/public/images/raspberry-pi-2.png` | Raspberry Pi photo 2 |
| Create | `frontend/public/images/raspberry-pi-3.png` | Raspberry Pi photo 3 |
| Create | `frontend/public/images/android-apk.png` | Android APK screenshot |
| Create | `frontend/src/app/components/documentation-page.jsx` | Full documentation page component |
| Create | `frontend/src/app/components/platforms-page.jsx` | Platforms page component (Web, Android, Raspberry Pi) |
| Modify | `frontend/src/app/App.jsx` | Add routing for `documentation` and `platforms` screens |

---

## Task 1: Fix Navbar / Dark Theme Color Issues

**Problem:** MUI's global theme sets `text.primary` to dark gray (`#1e293b`) and `MuiPaper.root.backgroundColor` to white. This causes:
1. Select dropdown menus to render with white backgrounds and dark text
2. Any MUI component using Paper (menus, popovers) to flash white
3. Form label text inheriting dark colors in some states

**Files:**
- Modify: `frontend/src/theme.js:208-255` (MuiPaper, MuiMenu, MuiMenuItem overrides)
- Modify: `frontend/src/app/components/contact-page.jsx` (MenuItem dark styling)

- [ ] **Step 1: Update MUI theme to fix Paper/Menu/Select defaults for dark surfaces**

In `frontend/src/theme.js`, update the `components` section to override Paper, Menu, MenuItem, and Select backgrounds for the dark theme:

```js
// In the components: { ... } section, add/update:
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#13102F',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: '#13102F',
          border: '1px solid rgba(232, 222, 248, 0.12)',
        },
        list: {
          padding: '4px',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          color: '#F4EEFF',
          fontSize: '0.9375rem',
          borderRadius: '6px',
          '&:hover': {
            backgroundColor: 'rgba(103, 80, 164, 0.15)',
          },
          '&.Mui-selected': {
            backgroundColor: 'rgba(103, 80, 164, 0.25)',
            '&:hover': {
              backgroundColor: 'rgba(103, 80, 164, 0.3)',
            },
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        icon: {
          color: 'rgba(244, 238, 255, 0.4)',
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          backgroundColor: '#13102F',
          border: '1px solid rgba(232, 222, 248, 0.12)',
        },
      },
    },
```

- [ ] **Step 2: Verify the contact page Select dropdown renders correctly**

The contact-page.jsx already has `inputSx` overrides for the input root, label, and select icon. The global theme fix in Step 1 should handle the dropdown menu. No further changes needed to contact-page.jsx unless the MenuItem text still appears dark — in which case add explicit `sx` to each MenuItem:

```jsx
<MenuItem key={option} value={option} sx={{ color: brandColors.offWhite }}>
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/theme.js frontend/src/app/components/contact-page.jsx
git commit -m "fix: dark theme overrides for MUI Paper, Menu, Select components"
```

---

## Task 2: Copy Images to Public Directory

**Files:**
- Create: `frontend/public/images/` directory and all image files

- [ ] **Step 1: Create public/images directory and copy all images**

```bash
mkdir -p frontend/public/images
cp "flowchart(2).png" frontend/public/images/flowchart-recording.png
cp "flowchart(4).png" frontend/public/images/flowchart-liveness.png
cp "flowchart(3).png" frontend/public/images/flowchart-hashing.png
cp "flowchart(1).png" frontend/public/images/flowchart-verification.png
cp "raspberry_pi(1).png" frontend/public/images/raspberry-pi-1.png
cp "raspberry_pi(2).png" frontend/public/images/raspberry-pi-2.png
cp "raspberry_pi(3).png" frontend/public/images/raspberry-pi-3.png
cp android_apk.png frontend/public/images/android-apk.png
```

- [ ] **Step 2: Commit**

```bash
git add frontend/public/images/
git commit -m "feat: add flowchart and platform images to public directory"
```

---

## Task 3: Create Documentation Page

**Files:**
- Create: `frontend/src/app/components/documentation-page.jsx`

This is the largest task. The page has these sections:
1. Hero ("Blockchain-Enabled Chain of Custody for Electronic Evidence")
2. The Problem
3. The Solution: Bedrock
4. The Technology: Stability GTN
5. How It Works (Record & Seal + Verify & Detect — with step cards)
6. One Engine, Many Use Cases
7. Technical Documentation subsections:
   - Recording Module (with `flowchart-recording.png`)
   - Liveness Flow (with `flowchart-liveness.png`) — mention AWS Rekognition
   - Hashing Algorithm (with `flowchart-hashing.png`)
   - Verification Flow (with `flowchart-verification.png`)
   - Smart Contract Interaction

- [ ] **Step 1: Create the documentation-page.jsx component**

The component follows the same pattern as instructions-page.jsx:
- Imports: Box, Container, Typography from MUI; Lucide icons; motion/react; Navbar; brandColors/fontTokens
- FadeUp animation wrapper
- Hero section with subtitle label + large heading + description
- Each content section separated by `borderBottom: 1px solid RULE_COLOR`
- Prose sections use `BODY_COLOR` for text, `fontTokens.body` for font
- Section headings use `fontTokens.ui`, `brandColors.offWhite`
- Flowchart images rendered as `<Box component="img">` with max-width, border-radius, and border styling
- Technical sections have a slightly different visual treatment (mono-styled subheaders)

Key content sections (all text from the user's spec):

**Hero:**
- Label: "Documentation"
- Heading: "Blockchain-Enabled Chain of Custody for Electronic Evidence"
- Subtitle: "A proof-of-concept for tamper-evident digital evidence management"

**Section: The Problem** — full paragraph from spec about AI-generated media, Singapore Evidence Act, forensics costs

**Section: The Solution: Bedrock** — full paragraph about real-time sealing, cryptographic fingerprinting, Stability GTN, POIC generation

**Section: The Technology: Stability GTN** — paragraph about cryptoless/public blockchain, gasless interactions, API key access, enterprise adoption

**Section: How It Works** — two subsections as styled step cards:
- Step 1: Record & Seal (4 bullet points: Liveness Check, Real-Time Fingerprinting, Permanent Anchoring, Court-Ready Output)
- Step 2: Verify & Detect (3 outcomes: authentic, tampered, fake)

**Section: Use Cases** — 3 cards:
- Web Application (For Professionals)
- Mobile App (For On-the-Go)
- Hardware Attestation (For Security)

**Section: Technical Documentation** — subsections each with a heading, paragraph, and flowchart image:
- Recording Module + `flowchart-recording.png`
- Liveness Flow (powered by AWS Rekognition) + `flowchart-liveness.png`
- Hashing Algorithm + `flowchart-hashing.png`
- Verification Flow + `flowchart-verification.png`
- Smart Contract Interaction (text description of grandfather/subcontract pattern)

Full component code must be written inline — see implementation step.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/components/documentation-page.jsx
git commit -m "feat: add documentation page with technical content and flowcharts"
```

---

## Task 4: Create Platforms Page

**Files:**
- Create: `frontend/src/app/components/platforms-page.jsx`

Three platform sections, each with description text and images:

- [ ] **Step 1: Create the platforms-page.jsx component**

**Hero:**
- Label: "Platforms"
- Heading: "Supported platforms"
- Subtitle: "Bedrock runs across web, mobile, and embedded hardware."

**Section 1: Web Application**
- Description: The current web app, built with React + Vite, running on Google Cloud Run. Full recording and verification flows with AWS Rekognition liveness, real-time blockchain anchoring, and certificate generation. No screenshot needed — it's the current app.

**Section 2: Android APK**
- Image: `android-apk.png`
- Description: "The APK is a native Kotlin application using Jetpack Compose for the UI, Camera2 for camera capture, and Material3 for the design system. Critically, the APK has no backend server and it signs blockchain transactions directly on-device using web3j 4.12.2, communicating with the GTN RPC endpoint without any intermediary. The private key for transaction signing is injected at compile time via local.properties/BuildConfig. Hashing uses Java's native MessageDigest class for SHA-256, producing identical outputs to the web application and operating in virtually the same way."

**Section 3: Raspberry Pi**
- Images: `raspberry-pi-1.png`, `raspberry-pi-2.png`, `raspberry-pi-3.png` (displayed in a grid)
- Description: Hardware attestation prototype using Raspberry Pi. Demonstrates that the Bedrock engine can be embedded directly into physical devices for tamper-proof capture from bodycams, drones, or CCTV systems.

Component follows same visual pattern as documentation-page.jsx.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/components/platforms-page.jsx
git commit -m "feat: add platforms page with web, android, and raspberry pi sections"
```

---

## Task 5: Wire Up Routing and Navigation

**Files:**
- Modify: `frontend/src/app/components/navbar.jsx:7-11` (add nav items)
- Modify: `frontend/src/app/App.jsx:17-19` (add imports) and `App.jsx:198-209` (add routing)

- [ ] **Step 1: Add nav items to navbar.jsx**

Update the `navItems` array at line 7-11 to include Documentation and Platforms:

```jsx
import { BookOpen, HelpCircle, Mail, FileText, Layers } from 'lucide-react';

const navItems = [
  { label: 'Instructions', screen: 'instructions', icon: BookOpen },
  { label: 'FAQ', screen: 'faq', icon: HelpCircle },
  { label: 'Documentation', screen: 'documentation', icon: FileText },
  { label: 'Platforms', screen: 'platforms', icon: Layers },
  { label: 'Contact', screen: 'contact', icon: Mail },
];
```

- [ ] **Step 2: Add imports and routing in App.jsx**

Add imports at the top of App.jsx:

```jsx
import { DocumentationPage } from '@/app/components/documentation-page';
import { PlatformsPage } from '@/app/components/platforms-page';
```

Add routing blocks after the contact screen conditional (around line 208):

```jsx
{currentScreen === 'documentation' && (
  <DocumentationPage onLogoClick={landingHome} onNavClick={landingNav} currentScreen={currentScreen} />
)}
{currentScreen === 'platforms' && (
  <PlatformsPage onLogoClick={landingHome} onNavClick={landingNav} currentScreen={currentScreen} />
)}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/components/navbar.jsx frontend/src/app/App.jsx
git commit -m "feat: wire up documentation and platforms pages in router and navbar"
```

---

## Task 6: Build, Deploy, and Verify

- [ ] **Step 1: Deploy to Cloud Run**

```bash
cd /Users/vaibhav/Downloads/BedRock-master
gcloud builds submit --config=cloudbuild.yaml --region=asia-south1
```

- [ ] **Step 2: Verify on live site**
- Check navbar stays dark on all pages (no white flash)
- Check contact form Subject dropdown has light text on dark background
- Navigate to Documentation page — verify all sections and flowchart images load
- Navigate to Platforms page — verify all sections and images load
- Check mobile responsiveness on all new pages
