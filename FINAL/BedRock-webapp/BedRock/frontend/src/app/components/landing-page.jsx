import { Box, Container, Typography, Button } from "@mui/material";
import { motion, useInView } from "motion/react";
import { useRef, useState, useEffect } from "react";
import {
  Link2,
  ShieldCheck,
  Scale,
  Building2,
  UserCheck,
  Video,
  Quote,
} from "lucide-react";
import Lottie from "lottie-react";
import animationData from "@/imports/Technology.json";
import { RotatingText } from "@/app/components/rotating-text";
import { Navbar } from "@/app/components/navbar";
import { Logo } from "@/app/components/logo";
import { brandColors, fontTokens } from "@/theme";
import { Timeline } from "@/app/components/ui/timeline";
import { DottedSurface } from "@/app/components/dotted-surface";

// ─── Shared Tokens ────────────────────────────────────────────────────────────

const SECTION_PY = { xs: 10, md: 14 };
const BODY_COLOR = "rgba(244, 238, 255, 0.72)";
const RULE_COLOR = "rgba(255,255,255,0.07)";
const EASE = [0.16, 1, 0.3, 1];

// ─── Data ─────────────────────────────────────────────────────────────────────

const howItWorksSteps = [
  {
    num: "01",
    icon: <Video size={22} />,
    title: "Record",
    body: "Capture video with our guided interface. A liveness check confirms a live subject is present at the moment of recording.",
    accent: "#4043F1",
    accentBg: "rgba(64,67,241,0.1)",
    accentBorder: "rgba(64,67,241,0.2)",
  },
  {
    num: "02",
    icon: <Link2 size={22} />,
    title: "Anchor",
    body: "A cryptographic hash of the file is generated and anchored to the blockchain, creating a timestamped, immutable record.",
    accent: "#7142FF",
    accentBg: "rgba(113,66,255,0.1)",
    accentBorder: "rgba(113,66,255,0.2)",
  },
  {
    num: "03",
    icon: <ShieldCheck size={22} />,
    title: "Verify",
    body: "Upload any video to compare its hash against the blockchain record. Tampering or modification is detected instantly.",
    accent: "#8B78C1",
    accentBg: "rgba(139,120,193,0.1)",
    accentBorder: "rgba(139,120,193,0.2)",
  },
];

const footerLinks = [
  { heading: "Product", links: ["Launch App", "How It Works", "Verify Video"] },
  { heading: "Company", links: ["FAQ", "Contact"] },
];

// Timeline data for audience section — verbatim from Frontend.md paragraph 4
const audienceTimelineData = [
  {
    title: "Legal Practitioners",
    content: (
      <Box sx={{ pb: { xs: 2, md: 2 } }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, mb: 0 }}>
          <Box
            sx={{
              width: 40, height: 40, borderRadius: "10px", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              bgcolor: "rgba(64,67,241,0.1)", border: "1px solid rgba(64,67,241,0.2)", color: "#6366F1",
            }}
          >
            <Scale size={18} />
          </Box>
          <Typography sx={{ color: "rgba(244,238,255,0.88)", fontSize: { xs: "0.9375rem", md: "1.0625rem" }, lineHeight: 1.85 }}>
            Legal practitioners presenting evidence.
          </Typography>
        </Box>
      </Box>
    ),
  },
  {
    title: "Organisations",
    content: (
      <Box sx={{ pb: { xs: 2, md: 2 } }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, mb: 0 }}>
          <Box
            sx={{
              width: 40, height: 40, borderRadius: "10px", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              bgcolor: "rgba(113,66,255,0.1)", border: "1px solid rgba(113,66,255,0.2)", color: "#7142FF",
            }}
          >
            <Building2 size={18} />
          </Box>
          <Typography sx={{ color: "rgba(244,238,255,0.88)", fontSize: { xs: "0.9375rem", md: "1.0625rem" }, lineHeight: 1.85 }}>
            Organisations accountable for the records they keep.
          </Typography>
        </Box>
      </Box>
    ),
  },
  {
    title: "Individuals",
    content: (
      <Box sx={{ pb: { xs: 2, md: 2 } }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, mb: 0 }}>
          <Box
            sx={{
              width: 40, height: 40, borderRadius: "10px", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              bgcolor: "rgba(139,120,193,0.1)", border: "1px solid rgba(139,120,193,0.2)", color: "#A78BFA",
            }}
          >
            <UserCheck size={18} />
          </Box>
          <Typography sx={{ color: "rgba(244,238,255,0.88)", fontSize: { xs: "0.9375rem", md: "1.0625rem" }, lineHeight: 1.85 }}>
            Individuals who need confidence that what they capture today will remain trustworthy tomorrow.
          </Typography>
        </Box>
      </Box>
    ),
  },
];

// ─── Animation Helpers ────────────────────────────────────────────────────────

function FadeUp({ children, delay = 0, style }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: false, margin: "-60px 0px -60px 0px" });
  return (
    <motion.div
      ref={ref}
      initial={false}
      animate={{ opacity: inView ? 1 : 0, y: inView ? 0 : 32 }}
      transition={{ duration: 0.6, delay: inView ? delay : 0, ease: EASE }}
      style={style}
    >
      {children}
    </motion.div>
  );
}

function FadeIn({ children, delay = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: false, margin: "-40px 0px -40px 0px" });
  return (
    <motion.div
      ref={ref}
      initial={false}
      animate={{ opacity: inView ? 1 : 0 }}
      transition={{ duration: 0.7, delay: inView ? delay : 0, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function HeroSection({ onDemoClick, onNavClick, currentScreen }) {
  const [btnHovered, setBtnHovered] = useState(false);
  const [clicked, setClicked] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const lottieRef = useRef(null);
  const mousePosRef = useRef(null);
  const heroRootRef = useRef(null);

  const handleMouseMove = (e) => {
    const rect = heroRootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    mousePosRef.current = { nx, ny };
  };
  const handleMouseLeave = () => { mousePosRef.current = null; };

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const handleHoverEnter = () => {
    setBtnHovered(true);
    lottieRef.current?.setSpeed(2.2);
  };
  const handleHoverLeave = () => {
    setBtnHovered(false);
    lottieRef.current?.setSpeed(1);
  };
  const handleDemoClick = () => {
    setClicked(true);
    setTimeout(onDemoClick, 750);
  };

  return (
    <Box
      ref={heroRootRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Grain texture */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          opacity: 0.065,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
        }}
      />

      {/* Signal rings — concentric circles centered on globe, static texture */}
      <motion.div
        animate={{ opacity: clicked ? 0 : 1 }}
        transition={{ duration: 0.35, ease: "easeIn" }}
        style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}
      >
        {[
          { size: isMobile ? 260 : 320,  alpha: 0.12  },
          { size: isMobile ? 420 : 520,  alpha: 0.08  },
          { size: isMobile ? 580 : 720,  alpha: 0.055 },
          { size: isMobile ? 740 : 940,  alpha: 0.03  },
        ].map(({ size, alpha }, i) => (
          <Box
            key={i}
            sx={{
              position: "absolute",
              left: "50%",
              top: "calc(50% + 6px)",
              width: `${size}px`,
              height: `${size}px`,
              marginLeft: `${-size / 2}px`,
              marginTop: `${-size / 2}px`,
              borderRadius: "50%",
              border: `1px solid rgba(139,120,193,${alpha})`,
              pointerEvents: "none",
            }}
          />
        ))}
      </motion.div>

      {/* ── Background layer: dots + globe ───────────────────────── */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        {/* Dotted wave field — bottom ≤1/3 of hero */}
        <DottedSurface
          melting={clicked}
          dotColor="#8B78C1"
          opacity={1}
          mobile={isMobile}
          mouseRef={mousePosRef}
        />

        {/* Hover glow — tracks globe center */}
        <motion.div
          animate={{
            opacity: clicked ? 0 : btnHovered ? 1 : 0,
          }}
          transition={{ duration: btnHovered ? 0.9 : 0.4, ease: "easeOut" }}
          style={{
            position: "absolute",
            left: "50%",
            top: "calc(50% + 6px)",
            width: isMobile ? "410px" : "610px",
            height: isMobile ? "410px" : "610px",
            marginLeft: isMobile ? "-205px" : "-305px",
            marginTop: isMobile ? "-205px" : "-305px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(139,120,193,0.2) 0%, rgba(103,80,164,0.08) 50%, transparent 72%)",
            pointerEvents: "none",
          }}
        />

        {/* Globe (Lottie) */}
        <motion.div
          animate={{
            opacity: clicked ? 0.85 : btnHovered ? 0.16 : 0.13,
            scale: clicked ? 3.5 : btnHovered ? 1.04 : 1,
          }}
          transition={clicked
            ? { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
            : { duration: btnHovered ? 1.8 : 0.55, ease: "easeOut" }
          }
          style={{
            position: "absolute",
            left: "50%",
            top: "calc(50% + 6px)",
            width: isMobile ? "410px" : "610px",
            marginLeft: isMobile ? "-205px" : "-305px",
            marginTop: isMobile ? "-205px" : "-305px",
            transformOrigin: "50% 50%",
            WebkitMaskImage: "radial-gradient(circle at 50% 50%, black 20%, rgba(0,0,0,0.9) 45%, rgba(0,0,0,0.72) 62%, rgba(0,0,0,0.45) 72%, rgba(0,0,0,0.12) 82%, transparent 90%)",
            maskImage: "radial-gradient(circle at 50% 50%, black 20%, rgba(0,0,0,0.9) 45%, rgba(0,0,0,0.72) 62%, rgba(0,0,0,0.45) 72%, rgba(0,0,0,0.12) 82%, transparent 90%)",
          }}
        >
          <Lottie
            lottieRef={lottieRef}
            animationData={animationData}
            loop
            speed={1}
            style={{ width: "100%", height: "100%" }}
          />
        </motion.div>

        {/* Click bloom */}
        <motion.div
          animate={{ opacity: clicked ? 1 : 0 }}
          transition={{ duration: 0.55, ease: "easeIn" }}
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse 120% 120% at 50% 80%, #1a0e3a 0%, #09070F 100%)",
            pointerEvents: "none",
            zIndex: 2,
          }}
        />
      </Box>

      <Navbar onDemoClick={onDemoClick} onNavClick={onNavClick} currentScreen={currentScreen} />

      {/* Spacer for fixed navbar */}
      <Box sx={{ height: 72, flexShrink: 0 }} />

      {/* Hero content — vertically centered in remaining space */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: { xs: 3, md: 6 },
          position: "relative",
          zIndex: 2,
        }}
      >
        <motion.div
          animate={{ opacity: clicked ? 0 : 1, y: clicked ? -16 : 0 }}
          transition={{ duration: 0.35, ease: "easeIn" }}
          style={{ width: "100%" }}
        >
          <Container maxWidth="lg">
            <Box sx={{ textAlign: "center", maxWidth: 780, mx: "auto" }}>

              {/* H1 */}
              <motion.div
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0, ease: EASE }}
              >
                <Box
                  component="h1"
                  sx={{
                    m: 0,
                    mb: 0.75,
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 0,
                    fontFamily: fontTokens.display,
                  }}
                >
                  {/* Line 1: "Verify Truth" — subdued prefix */}
                  <Box
                    component="span"
                    sx={{
                      display: "inline-block",
                      fontSize: { xs: "2.25rem", md: "3rem" },
                      fontWeight: 600,
                      lineHeight: 1.05,
                      letterSpacing: "-0.03em",
                      color: "rgba(244,238,255,0.62)",
                    }}
                  >
                    Verify Truth
                  </Box>
                  {/* Line 2: "with" — small uppercase connector */}
                  <Box
                    component="span"
                    sx={{
                      display: "inline-block",
                      fontSize: { xs: "0.625rem", md: "0.75rem" },
                      fontWeight: 600,
                      letterSpacing: "0.25em",
                      textTransform: "uppercase",
                      color: "rgba(244,238,255,0.22)",
                      mt: { xs: "0.45rem", md: "0.55rem" },
                      mb: { xs: "0.45rem", md: "0.55rem" },
                      fontFamily: fontTokens.ui,
                    }}
                  >
                    with
                  </Box>
                  {/* Line 3: rotating word — the focal point */}
                  <Box sx={{ fontSize: { xs: "3.5rem", md: "5.5rem" }, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.03em", fontFamily: fontTokens.display, width: "100%", textAlign: "center" }}>
                    <RotatingText words={["Blockchain", "Stability", "Bedrock"]} />
                  </Box>
                </Box>
              </motion.div>

              {/* Subhead */}
              <motion.div
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.1, ease: EASE }}
              >
                <Box sx={{ mb: 1.0, maxWidth: 480, mx: "auto" }}>
                  <Typography
                    sx={{
                      color: "rgba(244,238,255,0.5)",
                      fontSize: { xs: "0.875rem", md: "0.9375rem" },
                      lineHeight: 1.55,
                      fontFamily: fontTokens.body,
                      display: "block",
                      textAlign: "center",
                    }}
                  >
                    Tamper-evident video verification.
                  </Typography>
                  <Typography
                    sx={{
                      color: "rgba(244,238,255,0.5)",
                      fontSize: { xs: "0.875rem", md: "0.9375rem" },
                      lineHeight: 1.55,
                      fontFamily: fontTokens.body,
                      display: "block",
                      textAlign: "center",
                    }}
                  >
                    Anchored permanently to the blockchain.
                  </Typography>
                </Box>
              </motion.div>

              {/* CTA */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.18, ease: EASE }}
              >
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleDemoClick}
                  onMouseEnter={handleHoverEnter}
                  onMouseLeave={handleHoverLeave}
                  sx={{
                    py: 1.75,
                    px: 4.5,
                    fontSize: "0.9375rem",
                    fontWeight: 500,
                    bgcolor: "#6750A4",
                    color: "#F4EEFF",
                    borderRadius: "100px",
                    textTransform: "none",
                    boxShadow: "none",
                    transition: "background-color 0.25s",
                    "&:hover": {
                      bgcolor: "#8B78C1",
                      boxShadow: "none",
                    },
                    "&:active": { bgcolor: "#27174E", boxShadow: "none" },
                  }}
                >
                  Launch App
                </Button>
              </motion.div>

            </Box>
          </Container>
        </motion.div>

</Box>
    </Box>
  );
}

// ─── Stats Strip ──────────────────────────────────────────────────────────────

function StatsSection() {
  const stats = [
    { value: "SHA-256", label: "Cryptographic Hashing" },
    { value: "< 60s", label: "Time to Verify" },
    { value: "Immutable", label: "Blockchain Record" },
  ];

  return (
    <Box
      sx={{
        py: { xs: 2.5, md: 3 },
        borderTop: "1px solid rgba(255,255,255,0.06)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0,
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
            gap: { xs: 5, md: 0 },
          }}
        >
          {stats.map((s, i) => (
            <FadeUp key={s.value} delay={i * 0.07}>
              <Box
                sx={{
                  textAlign: "center",
                  position: "relative",
                  px: { md: 4 },
                  "&::after":
                    i < stats.length - 1
                      ? {
                          content: '""',
                          position: "absolute",
                          right: 0,
                          top: "10%",
                          height: "80%",
                          width: "1px",
                          bgcolor: "rgba(255,255,255,0.07)",
                          display: { xs: "none", md: "block" },
                        }
                      : {},
                }}
              >
                <Typography
                  sx={{
                    fontSize: { xs: "1.75rem", md: "2rem" },
                    fontWeight: 700,
                    color: "#F4EEFF",
                    letterSpacing: "-0.03em",
                    mb: 0.5,
                    fontFamily: fontTokens.ui,
                  }}
                >
                  {s.value}
                </Typography>
                <Typography sx={{ fontSize: "0.8125rem", color: "rgba(244,238,255,0.38)", fontFamily: fontTokens.ui }}>
                  {s.label}
                </Typography>
              </Box>
            </FadeUp>
          ))}
        </Box>
      </Container>
    </Box>
  );
}

// ─── Challenge Section ─────────────────────────────────────────────────────────
// Copy verbatim from Frontend.md paragraph 1

function ChallengeSection() {
  return (
    <Box
      sx={{
        bgcolor: "#09070F",
        py: SECTION_PY,
        borderTop: `1px solid ${RULE_COLOR}`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative large number watermark */}
      <Box
        sx={{
          position: "absolute",
          right: { xs: "-1rem", md: "2%" },
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: { xs: "13rem", md: "22rem" },
          fontWeight: 700,
          lineHeight: 1,
          color: "rgba(255,255,255,0.035)",
          letterSpacing: "-0.06em",
          userSelect: "none",
          pointerEvents: "none",
          fontFamily: fontTokens.ui,
        }}
      >
        01
      </Box>

      <Container maxWidth="lg">
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1.6fr" },
            gap: { xs: 6, md: 14 },
            alignItems: "center",
          }}
        >
          {/* Left: sticky label */}
          <FadeUp>
            <Box>
              <Typography
                sx={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: brandColors.purpleLight,
                  mb: 2,
                  fontFamily: fontTokens.ui,
                }}
              >
                The Challenge
              </Typography>
              <Typography
                variant="h2"
                sx={{
                  color: "#F4EEFF",
                  fontWeight: 600,
                  fontSize: { xs: "1.75rem", md: "2.25rem" },
                  lineHeight: 1.15,
                  letterSpacing: "-0.035em",
                  mb: 3,
                  fontFamily: fontTokens.ui,
                }}
              >
                Seeing is no longer{" "}
                <Box component="span" sx={{ fontStyle: "italic", color: brandColors.gold, fontFamily: fontTokens.display }}>enough</Box>.
              </Typography>
              {/* Decorative rule */}
              <Box
                sx={{
                  width: 48,
                  height: 3,
                  borderRadius: "2px",
                  background: `linear-gradient(90deg, ${brandColors.gold}, rgba(244,165,84,0.35))`,
                }}
              />
            </Box>
          </FadeUp>

          {/* Right: body copy */}
          <FadeUp delay={0.12}>
            <Typography
              sx={{
                color: "rgba(244,238,255,0.65)",
                fontSize: { xs: "1rem", md: "1.0625rem" },
                lineHeight: 1.75,
                fontFamily: fontTokens.body,
              }}
            >
              There was a time when a photograph, a recording, or a document could largely be taken at face
              value. Today, that assumption no longer holds. Artificial intelligence has made it possible to
              fabricate voices, alter footage, and generate entirely synthetic events with a level of realism
              that challenges even trained experts. As digital evidence becomes easier to manipulate,
              proving authenticity has quietly become harder, slower, and more expensive.
            </Typography>
          </FadeUp>
        </Box>
      </Container>
    </Box>
  );
}

// ─── Response Pull Quote ──────────────────────────────────────────────────────
// Copy verbatim from Frontend.md

function ResponseSection() {
  return (
    <Box
      sx={{
        bgcolor: "#0C0A1C",
        py: { xs: 14, md: 22 },
        borderTop: `1px solid ${RULE_COLOR}`,
        borderBottom: `1px solid ${RULE_COLOR}`,
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background glow */}
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "700px",
          height: "700px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(64,67,241,0.07) 0%, transparent 65%)",
          pointerEvents: "none",
        }}
      />

      <Container maxWidth="md" sx={{ position: "relative", zIndex: 1 }}>
        <FadeIn>
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              mb: 4,
            }}
          >
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                bgcolor: "rgba(64,67,241,0.08)",
                border: "1px solid rgba(64,67,241,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(64,67,241,0.7)",
              }}
            >
              <Quote size={18} />
            </Box>
          </Box>
          <Typography
            sx={{
              fontSize: { xs: "1.625rem", md: "2.5rem" },
              fontWeight: 300,
              lineHeight: 1.4,
              color: "#F4EEFF",
              letterSpacing: "-0.02em",
            }}
          >
            <Box component="span" sx={{ color: '#F4A554', fontStyle: 'italic', fontFamily: fontTokens.display }}>Bedrock was created in response to that shift.</Box>
          </Typography>
        </FadeIn>
      </Container>
    </Box>
  );
}

// ─── Platform Section [02] ────────────────────────────────────────────────────

function PlatformSection() {
  return (
    <Box
      sx={{
        bgcolor: "#09070F",
        py: SECTION_PY,
        borderTop: `1px solid ${RULE_COLOR}`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative large number watermark */}
      <Box
        sx={{
          position: "absolute",
          left: { xs: "-1rem", md: "0%" },
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: { xs: "13rem", md: "22rem" },
          fontWeight: 700,
          lineHeight: 1,
          color: "rgba(255,255,255,0.035)",
          letterSpacing: "-0.06em",
          userSelect: "none",
          pointerEvents: "none",
          fontFamily: fontTokens.ui,
        }}
      >
        02
      </Box>

      <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1.6fr" },
            gap: { xs: 6, md: 14 },
            alignItems: "center",
          }}
        >
          <FadeUp>
            <Box>
              <Typography
                sx={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: brandColors.purpleLight,
                  mb: 2,
                  fontFamily: fontTokens.ui,
                }}
              >
                The Platform
              </Typography>
              <Typography
                variant="h2"
                sx={{
                  color: "#F4EEFF",
                  fontWeight: 600,
                  fontSize: { xs: "1.75rem", md: "2.25rem" },
                  lineHeight: 1.15,
                  letterSpacing: "-0.035em",
                  mb: 3,
                  fontFamily: fontTokens.ui,
                }}
              >
                Proof at the moment of{" "}
                <Box component="span" sx={{ fontStyle: "italic", color: brandColors.gold, fontFamily: fontTokens.display }}>creation</Box>.
              </Typography>
              <Box
                sx={{
                  width: 48,
                  height: 3,
                  borderRadius: "2px",
                  background: `linear-gradient(90deg, ${brandColors.gold}, rgba(244,165,84,0.35))`,
                }}
              />
            </Box>
          </FadeUp>

          <FadeUp delay={0.1}>
            <Typography sx={{ color: "rgba(244,238,255,0.65)", fontSize: { xs: "1rem", md: "1.0625rem" }, lineHeight: 1.75, fontFamily: fontTokens.body }}>
              We believe the question facing courts, organisations, and individuals is no longer
              "Can this be edited?" Because almost anything can. The real question is
              "Can we prove that it wasn't?" Bedrock answers that question at the moment evidence comes into
              existence, not months later under scrutiny. By generating a cryptographic fingerprint at capture
              and anchoring it to an independent ledger, Bedrock establishes a verifiable record of origin and
              integrity that does not rely on memory, manual logs, or institutional trust alone.
            </Typography>
          </FadeUp>
        </Box>
      </Container>
    </Box>
  );
}

// ─── Platform Continued Section [03] ─────────────────────────────────────────

function PlatformContinuedSection() {
  return (
    <Box
      sx={{
        bgcolor: "#0C0A1C",
        py: SECTION_PY,
        borderTop: `1px solid ${RULE_COLOR}`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative large number watermark */}
      <Box
        sx={{
          position: "absolute",
          right: { xs: "-1rem", md: "1%" },
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: { xs: "13rem", md: "22rem" },
          fontWeight: 700,
          lineHeight: 1,
          color: "rgba(255,255,255,0.035)",
          letterSpacing: "-0.06em",
          userSelect: "none",
          pointerEvents: "none",
          fontFamily: fontTokens.ui,
        }}
      >
        03
      </Box>

      <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1.6fr 1fr" },
            gap: { xs: 6, md: 14 },
            alignItems: "center",
          }}
        >
          {/* Left: body copy */}
          <FadeUp>
            <Box
              sx={{
                pr: { md: 3 },
                borderRight: { md: "2px solid rgba(139,120,193,0.3)" },
                py: 0.5,
              }}
            >
              <Typography sx={{ color: "rgba(244,238,255,0.65)", fontSize: { xs: "1rem", md: "1.0625rem" }, lineHeight: 1.75, fontFamily: fontTokens.body }}>
                We designed Bedrock to fit quietly into the workflows where certainty matters most. Be it when
                preparing evidence for proceedings, maintaining regulated records, validating sensitive data, or
                preserving materials whose credibility may one day be questioned. The platform does not interpret
                truth, assign legal weight, or replace professional judgment. It simply ensures that the digital
                artefacts people rely on can be shown, with precision, to be unchanged.
              </Typography>
            </Box>
          </FadeUp>

          {/* Right: heading */}
          <FadeUp delay={0.1}>
            <Box>
              <Typography
                sx={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: brandColors.purpleLight,
                  mb: 2,
                  fontFamily: fontTokens.ui,
                }}
              >
                The Design
              </Typography>
              <Typography
                variant="h2"
                sx={{
                  color: "#F4EEFF",
                  fontWeight: 600,
                  fontSize: { xs: "1.75rem", md: "2.25rem" },
                  lineHeight: 1.15,
                  letterSpacing: "-0.035em",
                  mb: 3,
                  fontFamily: fontTokens.ui,
                }}
              >
                Built for where{" "}
                <Box component="span" sx={{ fontStyle: "italic", color: brandColors.gold, fontFamily: fontTokens.display }}>certainty</Box>{" "}
                matters most.
              </Typography>
              <Box
                sx={{
                  width: 48,
                  height: 3,
                  borderRadius: "2px",
                  background: `linear-gradient(90deg, ${brandColors.gold}, rgba(244,165,84,0.35))`,
                }}
              />
            </Box>
          </FadeUp>
        </Box>
      </Container>
    </Box>
  );
}

// ─── How It Works — Compact 3-column cards ────────────────────────────────────

function HowItWorksSection() {
  return (
    <Box
      sx={{
        bgcolor: "#0B091A",
        borderTop: `1px solid ${RULE_COLOR}`,
        py: SECTION_PY,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Section number watermark */}
      <Box
        sx={{
          position: "absolute",
          left: { xs: "-1rem", md: "0%" },
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: { xs: "13rem", md: "22rem" },
          fontWeight: 700,
          lineHeight: 1,
          color: "rgba(255,255,255,0.035)",
          letterSpacing: "-0.06em",
          userSelect: "none",
          pointerEvents: "none",
          fontFamily: fontTokens.ui,
        }}
      >
        04
      </Box>

      <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1 }}>
        {/* Header */}
        <FadeUp>
          <Box sx={{ mb: { xs: 6, md: 8 } }}>
            <Typography
              sx={{
                fontSize: "0.7rem",
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: brandColors.purpleLight,
                mb: 2,
                fontFamily: fontTokens.ui,
              }}
            >
              How It Works
            </Typography>
            <Typography
              variant="h2"
              sx={{
                color: "#F4EEFF",
                fontWeight: 600,
                fontSize: { xs: "1.75rem", md: "2.25rem" },
                letterSpacing: "-0.035em",
                lineHeight: 1.15,
                maxWidth: 520,
                fontFamily: fontTokens.ui,
              }}
            >
              From capture to{" "}
              <Box component="span" sx={{ fontStyle: "italic", color: brandColors.gold, fontFamily: fontTokens.display }}>verified</Box>{" "}
              in three steps.
            </Typography>
          </Box>
        </FadeUp>

        {/* 3-column card grid */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
            gap: { xs: 3, md: 3 },
          }}
        >
          {howItWorksSteps.map((step, i) => (
            <FadeUp key={step.num} delay={i * 0.08}>
              <Box
                sx={{
                  p: { xs: 3.5, md: 4 },
                  borderRadius: "16px",
                  border: `1px solid ${RULE_COLOR}`,
                  bgcolor: i === 0 ? "#0D0B1E" : i === 1 ? "#0F0C22" : "#110E25",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2.5,
                  transition: "border-color 0.2s",
                  "&:hover": { borderColor: step.accentBorder },
                }}
              >
                {/* Icon + step number row */}
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: "12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: step.accentBg,
                      border: `1px solid ${step.accentBorder}`,
                      color: step.accent,
                    }}
                  >
                    {step.icon}
                  </Box>
                  <Typography
                    sx={{
                      fontSize: "1.5rem",
                      fontWeight: 800,
                      color: "rgba(255,255,255,0.06)",
                      letterSpacing: "-0.04em",
                      lineHeight: 1,
                      fontFamily: fontTokens.ui,
                    }}
                  >
                    {step.num}
                  </Typography>
                </Box>

                {/* Title */}
                <Typography
                  sx={{
                    fontSize: { xs: "1.125rem", md: "1.25rem" },
                    fontWeight: 700,
                    color: "#F4EEFF",
                    letterSpacing: "-0.02em",
                    lineHeight: 1.25,
                    fontFamily: fontTokens.ui,
                  }}
                >
                  {step.title}
                </Typography>

                {/* Body */}
                <Typography
                  sx={{
                    fontSize: "0.9375rem",
                    color: BODY_COLOR,
                    lineHeight: 1.75,
                    flex: 1,
                    fontFamily: fontTokens.body,
                  }}
                >
                  {step.body}
                </Typography>

                {/* Accent bar */}
                <Box
                  sx={{
                    width: 32,
                    height: 2,
                    borderRadius: "1px",
                    background: `linear-gradient(90deg, ${brandColors.gold}, rgba(244,165,84,0.3))`,
                  }}
                />
              </Box>
            </FadeUp>
          ))}
        </Box>
      </Container>
    </Box>
  );
}

// ─── Audience Section — Two-column: heading left, timeline right ──────────────
// Copy verbatim from Frontend.md paragraph 4

function AudienceSection() {
  return (
    <Box
      sx={{
        bgcolor: "#0D0B1E",
        py: SECTION_PY,
        borderTop: `1px solid ${RULE_COLOR}`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Section number watermark */}
      <Box
        sx={{
          position: "absolute",
          right: { xs: "-1rem", md: "1%" },
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: { xs: "13rem", md: "22rem" },
          fontWeight: 700,
          lineHeight: 1,
          color: "rgba(255,255,255,0.035)",
          letterSpacing: "-0.06em",
          userSelect: "none",
          pointerEvents: "none",
          fontFamily: fontTokens.ui,
        }}
      >
        05
      </Box>

      <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "2fr 3fr" },
            gap: { xs: 6, md: 10 },
            alignItems: "center",
          }}
        >
          {/* Left: label + heading + subheader — sticky */}
          <FadeUp>
            <Box sx={{ position: { md: "sticky" }, top: { md: 100 } }}>
              <Typography
                sx={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: brandColors.purpleLight,
                  mb: 2,
                  fontFamily: fontTokens.ui,
                }}
              >
                Built For
              </Typography>
              <Typography
                variant="h2"
                sx={{
                  color: "#F4EEFF",
                  fontWeight: 600,
                  fontSize: { xs: "1.75rem", md: "2.25rem" },
                  lineHeight: 1.15,
                  letterSpacing: "-0.035em",
                  mb: 2.5,
                  fontFamily: fontTokens.ui,
                }}
              >
                Those who must stand behind the{" "}
                <Box component="span" sx={{ fontStyle: "italic", color: brandColors.gold, fontFamily: fontTokens.display }}>integrity</Box>{" "}
                of digital information.
              </Typography>
              <Box
                sx={{
                  width: 36,
                  height: 2,
                  borderRadius: "2px",
                  background: `linear-gradient(90deg, ${brandColors.gold}, rgba(244,165,84,0.35))`,
                  mb: 2,
                }}
              />
              <Typography
                sx={{
                  color: "rgba(244,238,255,0.65)",
                  fontSize: { xs: "1rem", md: "1.0625rem" },
                  lineHeight: 1.75,
                  fontFamily: fontTokens.body,
                }}
              >
                We built Bedrock to serve those who must stand behind the integrity of digital information.
              </Typography>
            </Box>
          </FadeUp>

          {/* Right: timeline */}
          <Timeline data={audienceTimelineData} />
        </Box>
      </Container>
    </Box>
  );
}

// ─── Foundation Quote ─────────────────────────────────────────────────────────
// Copy verbatim from Frontend.md final paragraph

function FoundationSection() {
  return (
    <Box
      sx={{
        bgcolor: "#09070F",
        py: { xs: 14, md: 22 },
        borderTop: `1px solid ${RULE_COLOR}`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(64,67,241,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <Container maxWidth="md" sx={{ position: "relative", zIndex: 1, textAlign: "center" }}>
        <FadeUp>
          <Typography
            sx={{
              fontSize: { xs: "1.375rem", md: "2rem" },
              fontWeight: 300,
              lineHeight: 1.6,
              color: "rgba(244,238,255,0.72)",
              letterSpacing: "-0.015em",
              mb: 1,
            }}
          >
            In an age of synthetic media and contested realities, Bedrock exists to provide something
            foundational.
          </Typography>
        </FadeUp>
        <FadeUp delay={0.14}>
          <Typography
            sx={{
              fontSize: { xs: "1.375rem", md: "2rem" },
              fontWeight: 600,
              lineHeight: 1.6,
              color: "#F4EEFF",
              letterSpacing: "-0.015em",
            }}
          >
            <Box component="span" sx={{ color: '#F4A554', fontStyle: 'italic', fontFamily: fontTokens.display }}>a stable point of verification in a landscape where seeing is no longer enough.</Box>
          </Typography>
        </FadeUp>
      </Container>
    </Box>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function CtaSection({ onDemoClick, onNavClick }) {
  return (
    <Box
      sx={{
        bgcolor: "#0D0B1E",
        py: { xs: 10, md: 14 },
        borderTop: `1px solid ${RULE_COLOR}`,
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(103,80,164,0.08) 0%, transparent 70%), radial-gradient(ellipse 50% 80% at 50% 100%, rgba(103,80,164,0.2) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <Container maxWidth="sm" sx={{ position: "relative", zIndex: 1 }}>
        <FadeUp>
          <Typography
            sx={{
              fontSize: { xs: "1.875rem", md: "2.5rem" },
              fontWeight: 700,
              color: "#F4EEFF",
              letterSpacing: "-0.03em",
              lineHeight: 1.2,
              mb: 1.5,
            }}
          >
            Start with Bedrock.
          </Typography>
        </FadeUp>
        <FadeUp delay={0.08}>
          <Typography sx={{ fontSize: "1rem", color: "rgba(244,238,255,0.5)", lineHeight: 1.7, mb: 4.5 }}>
            Record new evidence or verify an existing file. Both take under a minute.
          </Typography>
        </FadeUp>
        <FadeUp delay={0.14}>
          <Box sx={{ display: "flex", gap: 2, justifyContent: "center", flexWrap: "wrap" }}>
            <Button
              variant="contained"
              size="large"
              onClick={onDemoClick}
              sx={{
                py: 1.875,
                px: 5,
                fontSize: "0.9375rem",
                fontWeight: 500,
                bgcolor: "#6750A4",
                color: "#F4EEFF",
                borderRadius: "100px",
                textTransform: "none",
                boxShadow: "0 4px 28px rgba(103,80,164,0.5)",
                "&:hover": { bgcolor: "#8B78C1", boxShadow: "0 6px 36px rgba(139,120,193,0.55)" },
                "&:active": { bgcolor: "#27174E", boxShadow: "none" },
              }}
            >
              Launch App
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => onNavClick?.("instructions")}
              sx={{
                py: 1.875,
                px: 4,
                fontSize: "0.9375rem",
                fontWeight: 500,
                color: "rgba(244,238,255,0.75)",
                borderColor: "rgba(255,255,255,0.12)",
                borderRadius: "100px",
                textTransform: "none",
                bgcolor: "transparent",
                "&:hover": { borderColor: "rgba(139,120,193,0.5)", color: "#F4EEFF", bgcolor: "rgba(103,80,164,0.08)" },
                "&:active": { bgcolor: "rgba(103,80,164,0.15)" },
              }}
            >
              View Instructions
            </Button>
          </Box>
        </FadeUp>
      </Container>
    </Box>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer({ onDemoClick, onNavClick }) {
  const linkHandlers = {
    "Launch App": onDemoClick,
    "How It Works": () => onNavClick?.("instructions"),
    "Verify Video": () => onNavClick?.("upload"),
    "FAQ": () => onNavClick?.("faq"),
    "Contact": () => onNavClick?.("contact"),
  };

  return (
    <Box sx={{ bgcolor: "#09070F", borderTop: `1px solid ${RULE_COLOR}`, py: { xs: 8, md: 10 } }}>
      <Container maxWidth="lg">
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1.6fr 1fr 1fr" },
            gap: { xs: 6, md: 8 },
            mb: { xs: 6, md: 8 },
          }}
        >
          {/* Brand column */}
          <Box>
            <Box sx={{ mb: 2 }}>
              <Logo variant="horizontal" size="small" color={brandColors.offWhite} />
            </Box>
            <Typography
              sx={{
                fontSize: "0.875rem",
                color: "rgba(244,238,255,0.38)",
                lineHeight: 1.8,
                maxWidth: 280,
                mb: 3,
                fontFamily: fontTokens.body,
              }}
            >
              Tamper-evident video verification.{"\n"}Anchored permanently to the blockchain.
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: "rgba(244,238,255,0.2)", fontFamily: fontTokens.body }}>
              © 2026 Bedrock. All rights reserved.
            </Typography>
          </Box>

          {/* Link columns */}
          {footerLinks.map((col) => (
            <Box key={col.heading}>
              <Typography
                sx={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "rgba(244,238,255,0.32)",
                  mb: 2.5,
                  fontFamily: fontTokens.ui,
                }}
              >
                {col.heading}
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {col.links.map((link) => (
                  <Typography
                    key={link}
                    onClick={linkHandlers[link]}
                    sx={{
                      fontSize: "0.875rem",
                      color: "rgba(244,238,255,0.38)",
                      cursor: "pointer",
                      fontFamily: fontTokens.body,
                      transition: "color 0.2s",
                      "&:hover": { color: "rgba(244,238,255,0.75)" },
                    }}
                  >
                    {link}
                  </Typography>
                ))}
              </Box>
            </Box>
          ))}
        </Box>

        {/* Bottom rule */}
        <Box sx={{ borderTop: "1px solid rgba(255,255,255,0.05)", pt: 3 }}>
          <Typography sx={{ fontSize: "0.75rem", color: "rgba(244,238,255,0.18)", textAlign: "center", fontFamily: fontTokens.body }}>
            verify@bedrock.com.sg
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function LandingPage({ onDemoClick, onNavClick, currentScreen }) {
  return (
    <Box sx={{ bgcolor: "#09070F" }}>
      {/* Hero + Stats = exactly 100vh, sharing one background band */}
      <Box sx={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: `radial-gradient(ellipse 120% 80% at 50% 10%, rgba(55,20,110,0.55) 0%, rgba(35,12,80,0.28) 55%, transparent 80%), radial-gradient(ellipse 60% 30% at 50% 100%, rgba(10,6,28,0.98) 0%, transparent 80%), ${brandColors.appBg}`,
      }}>
        <HeroSection onDemoClick={onDemoClick} onNavClick={onNavClick} currentScreen={currentScreen} />
        <StatsSection />
      </Box>
      <ChallengeSection />
      <ResponseSection />
      <PlatformSection />
      <PlatformContinuedSection />
      <HowItWorksSection />
      <AudienceSection />
      <FoundationSection />
      <CtaSection onDemoClick={onDemoClick} onNavClick={onNavClick} />
      <Footer onDemoClick={onDemoClick} onNavClick={onNavClick} />
    </Box>
  );
}
