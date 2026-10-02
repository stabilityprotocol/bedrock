import { Box, Container, Typography } from "@mui/material";
import { Shield, Search, Monitor, Smartphone, Cpu, ChevronRight } from "lucide-react";
import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { Navbar } from "@/app/components/navbar";
import { brandColors, fontTokens } from "@/theme";

const BODY_COLOR = "rgba(244,238,255,0.72)";
const RULE_COLOR = "rgba(255,255,255,0.07)";
const ACCENT_PURPLE = "rgba(103,80,164,0.7)";
const ACCENT_BLUE = "rgba(64,67,241,0.7)";
const ACCENT_GREEN = "rgba(16,185,129,0.7)";
const EASE = [0.16, 1, 0.3, 1];

function FadeUp({ children, delay = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

function SectionLabel({ color = ACCENT_PURPLE, children }) {
  return (
    <Typography
      sx={{
        fontSize: "0.6875rem",
        fontWeight: 600,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color,
        mb: 2,
        fontFamily: fontTokens.ui,
        textAlign: "center",
      }}
    >
      {children}
    </Typography>
  );
}

function SectionHeading({ children }) {
  return (
    <Typography
      variant="h2"
      sx={{
        color: brandColors.offWhite,
        fontWeight: 600,
        fontSize: { xs: "2rem", md: "2.875rem" },
        letterSpacing: "-0.035em",
        lineHeight: 1.15,
        mb: 2,
        textAlign: "center",
      }}
    >
      {children}
    </Typography>
  );
}

function Prose({ children }) {
  return (
    <Typography
      sx={{
        fontSize: { xs: "0.9375rem", md: "1rem" },
        color: BODY_COLOR,
        lineHeight: 1.8,
        fontFamily: fontTokens.body,
        maxWidth: 680,
        mx: "auto",
        textAlign: "center",
      }}
    >
      {children}
    </Typography>
  );
}

function StepCard({ icon, title, bullets, accentColor = ACCENT_PURPLE }) {
  return (
    <Box
      sx={{
        p: { xs: 3, md: 4 },
        borderRadius: "16px",
        border: `1px solid ${RULE_COLOR}`,
        bgcolor: "rgba(19,16,47,0.5)",
        flex: 1,
        minWidth: 0,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: "12px",
            bgcolor: `${accentColor.replace("0.7", "0.12")}`,
            border: `1px solid ${accentColor.replace("0.7", "0.25")}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: accentColor.replace("0.7", "1"),
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Typography
          sx={{
            fontSize: { xs: "1.125rem", md: "1.25rem" },
            fontWeight: 600,
            color: brandColors.offWhite,
            letterSpacing: "-0.02em",
            fontFamily: fontTokens.ui,
          }}
        >
          {title}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {bullets.map((b, i) => (
          <Box key={i} sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
            <ChevronRight
              size={16}
              style={{ flexShrink: 0, marginTop: 3, color: accentColor.replace("0.7", "0.5") }}
            />
            <Box>
              {b.label && (
                <Typography
                  component="span"
                  sx={{
                    fontWeight: 600,
                    color: brandColors.offWhite,
                    fontSize: "0.9375rem",
                    fontFamily: fontTokens.ui,
                  }}
                >
                  {b.label}:{" "}
                </Typography>
              )}
              <Typography
                component="span"
                sx={{
                  fontSize: "0.9375rem",
                  color: BODY_COLOR,
                  lineHeight: 1.7,
                  fontFamily: fontTokens.body,
                }}
              >
                {b.text}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function UseCaseCard({ icon, title, description }) {
  return (
    <Box
      sx={{
        p: { xs: 3, md: 3.5 },
        borderRadius: "12px",
        border: `1px solid ${RULE_COLOR}`,
        bgcolor: "rgba(19,16,47,0.5)",
        flex: 1,
        minWidth: 0,
        textAlign: "center",
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: "10px",
          bgcolor: "rgba(103,80,164,0.12)",
          border: "1px solid rgba(103,80,164,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: brandColors.purpleLight,
          mb: 2.5,
          mx: "auto",
        }}
      >
        {icon}
      </Box>
      <Typography
        sx={{
          fontSize: "1.0625rem",
          fontWeight: 600,
          color: brandColors.offWhite,
          letterSpacing: "-0.01em",
          mb: 1,
          fontFamily: fontTokens.ui,
        }}
      >
        {title}
      </Typography>
      <Typography
        sx={{ fontSize: "0.9375rem", color: BODY_COLOR, lineHeight: 1.7, fontFamily: fontTokens.body }}
      >
        {description}
      </Typography>
    </Box>
  );
}

export function DocumentationPage({ onLogoClick, onNavClick, currentScreen }) {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: brandColors.appBg, color: brandColors.offWhite }}>
      <Navbar onLogoClick={onLogoClick} onNavClick={onNavClick} currentScreen={currentScreen} />

      {/* ── Hero ── */}
      <Box
        sx={{
          pt: { xs: "120px", md: "140px" },
          pb: { xs: 8, md: 10 },
          borderBottom: `1px solid ${RULE_COLOR}`,
          position: "relative",
          overflow: "hidden",
          textAlign: "center",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "800px",
            height: "400px",
            background:
              "radial-gradient(ellipse 60% 60% at 50% 0%, rgba(103,80,164,0.14) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <Container maxWidth="md" sx={{ position: "relative", zIndex: 1 }}>
          <FadeUp>
            <SectionLabel>Documentation</SectionLabel>
            <Typography
              sx={{
                fontFamily: fontTokens.ui,
                color: brandColors.offWhite,
                fontWeight: 600,
                fontSize: { xs: "2.25rem", md: "3.5rem" },
                letterSpacing: "-0.035em",
                lineHeight: 1.1,
                mb: 3,
              }}
            >
              Blockchain-Enabled Chain of Custody for Electronic Evidence
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: "1.0625rem", md: "1.25rem" },
                color: BODY_COLOR,
                lineHeight: 1.75,
                maxWidth: 620,
                mx: "auto",
                fontFamily: fontTokens.body,
              }}
            >
              A proof-of-concept for tamper-evident digital evidence management.
            </Typography>
          </FadeUp>
        </Container>
      </Box>

      {/* ── 1. The Problem ── */}
      <Box sx={{ py: { xs: 8, md: 12 }, borderBottom: `1px solid ${RULE_COLOR}` }}>
        <Container maxWidth="md">
          <FadeUp>
            <SectionLabel color="rgba(220,38,38,0.65)">The Problem</SectionLabel>
            <SectionHeading>Authenticity of digital evidence is under threat</SectionHeading>
          </FadeUp>
          <FadeUp delay={0.05}>
            <Prose>
              As AI-generated media becomes indistinguishable from real footage, the authenticity of
              digital video evidence is increasingly easy to challenge in court. Under Singapore's
              Evidence Act (Section 116A), and in legal systems globally, electronic records are
              presumed authentic.
            </Prose>
            <Box sx={{ mt: 2 }}>
              <Prose>
                To challenge the authenticity, one has to hire a digital forensics expert
                ($3,000{"\u2013"}$5,000 for basic services), wait 6{"\u2013"}8 weeks for a report, and
                hope the chain of custody is intact. The process is expensive, slow, and reactive. It
                does not scale to routine disputes, business proceedings, or everyday legal matters.
              </Prose>
            </Box>
          </FadeUp>
        </Container>
      </Box>

      {/* ── 2. The Solution ── */}
      <Box sx={{ py: { xs: 8, md: 12 }, borderBottom: `1px solid ${RULE_COLOR}` }}>
        <Container maxWidth="md">
          <FadeUp>
            <SectionLabel color={ACCENT_GREEN}>The Solution</SectionLabel>
            <SectionHeading>Bedrock seals evidence at the moment of capture</SectionHeading>
          </FadeUp>
          <FadeUp delay={0.05}>
            <Prose>
              Where existing tools attempt to detect manipulation after the fact, Bedrock eliminates
              the need for that detection entirely{"\u2014"}by creating a cryptographic record of the
              video as it is being recorded, making any subsequent tampering mathematically provable.
            </Prose>
            <Box sx={{ mt: 2 }}>
              <Prose>
                Bedrock computes a unique digital fingerprint across the video stream in real time,
                anchoring each fingerprint to a smart contract on Stability Protocol's Global Trust
                Network (GTN){"\u2014"}a tokenless, zero-fee, EVM-compatible public blockchain. No
                wallets, no gas fees, no crypto knowledge required.
              </Prose>
            </Box>
            <Box sx={{ mt: 2 }}>
              <Prose>
                The result is an immutable, independently verifiable chain of custody that exists on
                a public ledger and requires no trusted intermediary to authenticate. On recording
                completion, Bedrock generates a Proof of Integrity Certificate (POIC){"\u2014"}a PDF
                containing the subcontract address, final rolling hash, timestamps, and recording
                metadata, ready for court submission.
              </Prose>
            </Box>
          </FadeUp>
        </Container>
      </Box>

      {/* ── 3. The Technology ── */}
      <Box sx={{ py: { xs: 8, md: 12 }, borderBottom: `1px solid ${RULE_COLOR}` }}>
        <Container maxWidth="md">
          <FadeUp>
            <SectionLabel color={ACCENT_BLUE}>The Technology</SectionLabel>
            <SectionHeading>Stability Global Trust Network</SectionHeading>
          </FadeUp>
          <FadeUp delay={0.05}>
            <Prose>
              While the technology is invisible to the user, Bedrock is powered by enterprise-grade
              architecture. The backbone of Bedrock is STABILITY's Global Trust Network (GTN).
            </Prose>
            <Box sx={{ mt: 2 }}>
              <Prose>
                Unlike conventional blockchains, GTN is entirely cryptoless and public. Blockchain
                interactions are gasless and not associated with volatile crypto tokens. Network
                access is managed through standard API keys. This eliminates the regulatory,
                compliance, and reputational hurdles that typically block law firms, governments, and
                corporations from adopting blockchain technology, while maintaining absolute data
                immutability.
              </Prose>
            </Box>
          </FadeUp>
        </Container>
      </Box>

      {/* ── 4. How It Works ── */}
      <Box sx={{ py: { xs: 8, md: 12 }, borderBottom: `1px solid ${RULE_COLOR}` }}>
        <Container maxWidth="lg">
          <FadeUp>
            <Box sx={{ textAlign: "center", mb: { xs: 4, md: 6 } }}>
              <SectionLabel>How It Works</SectionLabel>
              <SectionHeading>Two core workflows</SectionHeading>
            </Box>
          </FadeUp>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
              gap: 3,
            }}
          >
            <FadeUp delay={0.05}>
              <StepCard
                icon={<Shield size={22} />}
                title="Step 1: Record & Seal"
                accentColor={ACCENT_PURPLE}
                bullets={[
                  {
                    label: "Liveness Check",
                    text: "Before recording, a liveness check using flashing colours verifies a human is present and blocks pre-recorded deepfakes.",
                  },
                  {
                    label: "Real-Time Fingerprinting",
                    text: 'As you record, the app chunks the video into tiny segments, assigns a unique "digital fingerprint" to each chunk. Each fingerprint has traits from previous chunks to establish a continuous chain.',
                  },
                  {
                    label: "Permanent Anchoring",
                    text: "These fingerprints are continuously written onto the GTN. Like a public noticeboard written in permanent ink, it can be read by anyone but never erased or altered.",
                  },
                  {
                    label: "Court-Ready Output",
                    text: "When you stop recording, the raw video and Proof-of-Integrity Certificate (your official capture and logging receipt) will be downloaded.",
                  },
                ]}
              />
            </FadeUp>
            <FadeUp delay={0.1}>
              <StepCard
                icon={<Search size={22} />}
                title="Step 2: Verify & Detect"
                accentColor={ACCENT_BLUE}
                bullets={[
                  {
                    label: "Authentic",
                    text: "The system confirms the video matches the blockchain record perfectly.",
                  },
                  {
                    label: "Tampered",
                    text: 'The system instantly alerts the user and pinpoints the exact second the video was altered (e.g., "Altered starting at 00:14").',
                  },
                  {
                    label: "Not recorded with Bedrock",
                    text: "The system shows the video was never recorded through the secure liveness system to begin with.",
                  },
                ]}
              />
            </FadeUp>
          </Box>
        </Container>
      </Box>

      {/* ── 5. Use Cases ── */}
      <Box sx={{ py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <FadeUp>
            <Box sx={{ textAlign: "center", mb: { xs: 4, md: 6 } }}>
              <SectionLabel color={ACCENT_GREEN}>Use Cases</SectionLabel>
              <SectionHeading>One engine, many applications</SectionHeading>
            </Box>
          </FadeUp>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
              gap: 2.5,
            }}
          >
            <FadeUp delay={0.05}>
              <UseCaseCard
                icon={<Monitor size={20} />}
                title="Web Application"
                description="Perfect for lawyers and business leaders recording remote depositions, HR conflict resolutions, virtual board meetings, or contract signings directly from a laptop."
              />
            </FadeUp>
            <FadeUp delay={0.1}>
              <UseCaseCard
                icon={<Smartphone size={20} />}
                title="Mobile App"
                description="A fast-launch application designed for investigative journalists, citizens documenting incidents, or anyone needing to capture high-stakes events securely on their phone."
              />
            </FadeUp>
            <FadeUp delay={0.15}>
              <UseCaseCard
                icon={<Cpu size={20} />}
                title="Hardware Attestation"
                description="Bedrock can be integrated directly into physical devices such as law enforcement bodycams, drones, or corporate CCTV systems, ensuring monitoring footage is always real."
              />
            </FadeUp>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
