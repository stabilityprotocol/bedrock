import { Box, Container, Typography } from "@mui/material";
import { Globe, Smartphone, Cpu, Server, Blocks, Fingerprint } from "lucide-react";
import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { Navbar } from "@/app/components/navbar";
import { brandColors, fontTokens } from "@/theme";

const BODY_COLOR = "rgba(244,238,255,0.72)";
const RULE_COLOR = "rgba(255,255,255,0.07)";
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

function PlatformImage({ src, alt }) {
  return (
    <Box
      sx={{
        borderRadius: "12px",
        border: `1px solid ${RULE_COLOR}`,
        overflow: "hidden",
        bgcolor: "rgba(19,16,47,0.6)",
      }}
    >
      <Box
        component="img"
        src={src}
        alt={alt}
        sx={{
          width: "100%",
          height: "auto",
          display: "block",
        }}
      />
    </Box>
  );
}

function SpecBadge({ icon, label }) {
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        px: 1.5,
        py: 0.625,
        borderRadius: "100px",
        bgcolor: "rgba(103,80,164,0.1)",
        border: "1px solid rgba(103,80,164,0.2)",
      }}
    >
      {icon}
      <Typography
        sx={{
          fontSize: "0.75rem",
          fontWeight: 500,
          color: brandColors.purpleLight,
          fontFamily: fontTokens.mono,
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

export function PlatformsPage({ onLogoClick, onNavClick, currentScreen }) {
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
              "radial-gradient(ellipse 60% 60% at 50% 0%, rgba(64,67,241,0.1) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <Container maxWidth="md" sx={{ position: "relative", zIndex: 1, textAlign: "center" }}>
          <FadeUp>
            <Typography
              sx={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(64,67,241,0.7)",
                mb: 2,
                fontFamily: fontTokens.ui,
              }}
            >
              Platforms
            </Typography>
            <Typography
              sx={{
                fontFamily: fontTokens.ui,
                color: brandColors.offWhite,
                fontWeight: 600,
                fontSize: { xs: "2.5rem", md: "4rem" },
                letterSpacing: "-0.035em",
                lineHeight: 1.1,
                mb: 3,
              }}
            >
              Supported platforms
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: "1.0625rem", md: "1.25rem" },
                color: BODY_COLOR,
                lineHeight: 1.75,
                maxWidth: 560,
                mx: "auto",
                fontFamily: fontTokens.body,
              }}
            >
              Bedrock runs across web, mobile, and embedded hardware. The same core engine powers
              every platform.
            </Typography>
          </FadeUp>
        </Container>
      </Box>

      {/* ── Web Application ── */}
      <Box sx={{ py: { xs: 8, md: 12 }, borderBottom: `1px solid ${RULE_COLOR}` }}>
        <Container maxWidth="lg">
          <FadeUp>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                gap: { xs: 4, md: 8 },
                alignItems: "center",
              }}
            >
              <Box>
                <Typography
                  sx={{
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "rgba(139,120,193,0.7)",
                    mb: 2,
                    fontFamily: fontTokens.ui,
                  }}
                >
                  Platform 01
                </Typography>
                <Typography
                  variant="h2"
                  sx={{
                    color: brandColors.offWhite,
                    fontWeight: 600,
                    fontSize: { xs: "2rem", md: "2.5rem" },
                    letterSpacing: "-0.035em",
                    lineHeight: 1.15,
                    mb: 2.5,
                  }}
                >
                  Web Application
                </Typography>
                <Typography
                  sx={{
                    fontSize: "0.9375rem",
                    color: BODY_COLOR,
                    lineHeight: 1.8,
                    fontFamily: fontTokens.body,
                    mb: 3,
                  }}
                >
                  The primary Bedrock interface, built with React and Vite, deployed on Google Cloud
                  Run. It provides the full recording and verification workflow: AWS Rekognition
                  liveness checks, real-time blockchain anchoring via the backend hashing pipeline, and
                  automatic generation of the Proof of Integrity Certificate. Designed for legal
                  professionals, businesses, and institutions operating from a desktop or laptop.
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                  <SpecBadge icon={<Globe size={12} />} label="React + Vite" />
                  <SpecBadge icon={<Server size={12} />} label="Cloud Run" />
                  <SpecBadge icon={<Fingerprint size={12} />} label="AWS Rekognition" />
                  <SpecBadge icon={<Blocks size={12} />} label="Stability GTN" />
                </Box>
              </Box>
              <Box
                sx={{
                  p: { xs: 3, md: 4 },
                  borderRadius: "16px",
                  border: `1px solid ${RULE_COLOR}`,
                  bgcolor: "rgba(19,16,47,0.4)",
                  textAlign: "center",
                }}
              >
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    bgcolor: "rgba(103,80,164,0.12)",
                    border: "1px solid rgba(103,80,164,0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: brandColors.purpleLight,
                    mx: "auto",
                    mb: 2.5,
                  }}
                >
                  <Globe size={36} />
                </Box>
                <Typography
                  sx={{
                    fontSize: "1rem",
                    fontWeight: 500,
                    color: brandColors.offWhite,
                    mb: 1,
                    fontFamily: fontTokens.ui,
                  }}
                >
                  Currently active
                </Typography>
                <Typography
                  sx={{
                    fontSize: "0.8125rem",
                    color: "rgba(244,238,255,0.4)",
                    fontFamily: fontTokens.body,
                  }}
                >
                  You are using this platform right now.
                </Typography>
              </Box>
            </Box>
          </FadeUp>
        </Container>
      </Box>

      {/* ── Android APK ── */}
      <Box sx={{ py: { xs: 8, md: 12 }, borderBottom: `1px solid ${RULE_COLOR}` }}>
        <Container maxWidth="lg">
          <FadeUp>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                gap: { xs: 4, md: 8 },
                alignItems: "center",
              }}
            >
              <Box sx={{ order: { xs: 1, md: 2 } }}>
                <Typography
                  sx={{
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "rgba(16,185,129,0.7)",
                    mb: 2,
                    fontFamily: fontTokens.ui,
                  }}
                >
                  Platform 02
                </Typography>
                <Typography
                  variant="h2"
                  sx={{
                    color: brandColors.offWhite,
                    fontWeight: 600,
                    fontSize: { xs: "2rem", md: "2.5rem" },
                    letterSpacing: "-0.035em",
                    lineHeight: 1.15,
                    mb: 2.5,
                  }}
                >
                  Android APK
                </Typography>
                <Typography
                  sx={{
                    fontSize: "0.9375rem",
                    color: BODY_COLOR,
                    lineHeight: 1.8,
                    fontFamily: fontTokens.body,
                    mb: 3,
                  }}
                >
                  The APK is a native Kotlin application using Jetpack Compose for the UI, Camera2
                  for camera capture, and Material3 for the design system. Critically, the APK has no
                  backend server and signs blockchain transactions directly on-device using web3j
                  4.12.2, communicating with the GTN RPC endpoint without any intermediary. The
                  private key for transaction signing is injected at compile time via
                  local.properties/BuildConfig. Hashing uses Java's native MessageDigest class for
                  SHA-256, producing identical outputs to the web application and operating in
                  virtually the same way.
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                  <SpecBadge icon={<Smartphone size={12} />} label="Kotlin" />
                  <SpecBadge icon={<Globe size={12} />} label="Jetpack Compose" />
                  <SpecBadge icon={<Blocks size={12} />} label="web3j 4.12.2" />
                  <SpecBadge icon={<Fingerprint size={12} />} label="SHA-256 on-device" />
                </Box>
              </Box>
              <Box
                sx={{
                  order: { xs: 2, md: 1 },
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <Box
                  sx={{
                    maxWidth: 280,
                    borderRadius: "24px",
                    border: `1px solid ${RULE_COLOR}`,
                    overflow: "hidden",
                    bgcolor: "rgba(19,16,47,0.6)",
                    boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
                  }}
                >
                  <Box
                    component="img"
                    src="/images/platforms/android-apk.png"
                    alt="Bedrock Android application showing Record Evidence and Verify Video buttons"
                    sx={{ width: "100%", height: "auto", display: "block" }}
                  />
                </Box>
              </Box>
            </Box>
          </FadeUp>
        </Container>
      </Box>

      {/* ── Raspberry Pi ── */}
      <Box sx={{ py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <FadeUp>
            <Typography
              sx={{
                fontSize: "0.6875rem",
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(220,38,38,0.6)",
                mb: 2,
                fontFamily: fontTokens.ui,
              }}
            >
              Platform 03
            </Typography>
            <Typography
              variant="h2"
              sx={{
                color: brandColors.offWhite,
                fontWeight: 600,
                fontSize: { xs: "2rem", md: "2.5rem" },
                letterSpacing: "-0.035em",
                lineHeight: 1.15,
                mb: 2.5,
              }}
            >
              Raspberry Pi Hardware Prototype
            </Typography>
            <Typography
              sx={{
                fontSize: "0.9375rem",
                color: BODY_COLOR,
                lineHeight: 1.8,
                fontFamily: fontTokens.body,
                maxWidth: 720,
                mb: 4,
              }}
            >
              A hardware attestation prototype demonstrating that the Bedrock engine can be embedded
              directly into physical devices. This Raspberry Pi unit captures tamper-proof video with
              the same hashing and blockchain anchoring pipeline used in the web and mobile
              applications. The form factor is designed for integration into bodycams, drones, CCTV
              systems, and other field-deployed surveillance equipment where the integrity of captured
              footage must be guaranteed from the moment of recording.
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: { xs: 4, md: 6 } }}>
              <SpecBadge icon={<Cpu size={12} />} label="Raspberry Pi" />
              <SpecBadge icon={<Blocks size={12} />} label="Stability GTN" />
              <SpecBadge icon={<Fingerprint size={12} />} label="SHA-256" />
            </Box>
          </FadeUp>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
              gap: 2.5,
            }}
          >
            {[
              { src: "/images/platforms/raspberry-pi-1.png", alt: "Raspberry Pi Bedrock unit with display showing recording interface" },
              { src: "/images/platforms/raspberry-pi-2.png", alt: "Raspberry Pi board in 3D-printed enclosure" },
              { src: "/images/platforms/raspberry-pi-3.png", alt: "Raspberry Pi enclosure being designed in MakerSpace" },
            ].map((img, i) => (
              <FadeUp key={img.src} delay={i * 0.08}>
                <PlatformImage src={img.src} alt={img.alt} />
              </FadeUp>
            ))}
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
