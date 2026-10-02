import { Box, Container, Typography } from "@mui/material";
import { ScanFace, Upload, ShieldCheck, AlertCircle, Video, Camera, Download, FileCheck, MousePointerClick } from "lucide-react";
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

const recordSteps = [
  {
    num: "01",
    icon: <MousePointerClick size={22} />,
    title: "Open the app",
    body: "From the landing page, click \u201cLaunch App\u201d. On the app screen, select \u201cRecord Evidence\u201d to begin a new tamper-proof recording.",
  },
  {
    num: "02",
    icon: <FileCheck size={22} />,
    title: "Review consent and confirmation",
    body: "You\u2019ll be shown a data consent notice explaining what is recorded and how it is stored. Read it carefully, then confirm you understand that this action cannot be undone.",
  },
  {
    num: "03",
    icon: <Camera size={22} />,
    title: "Allow camera and microphone access",
    body: "Your browser will request permission to access your camera and microphone. Both are required. If prompted, click \u201cAllow\u201d to continue.",
  },
  {
    num: "04",
    icon: <ScanFace size={22} />,
    title: "Complete liveness verification",
    body: "Before recording begins, the app confirms a live person is present. Follow the on-screen prompts \u2014 this typically takes a few seconds and helps prevent spoofing.",
  },
  {
    num: "05",
    icon: <Video size={22} />,
    title: "Record your video",
    body: "Follow the guided interface to capture your recording. As you record, a cryptographic hash of the video is generated in real time and anchored to the blockchain with a timestamp.",
  },
  {
    num: "06",
    icon: <Download size={22} />,
    title: "Download your files",
    body: "Once complete, you\u2019ll see a confirmation screen showing your recording\u2019s timestamp and duration. Two files will be downloaded: your video recording and a certificate confirming the blockchain anchor. Keep both files together.",
  },
];

const verifySteps = [
  {
    num: "01",
    icon: <MousePointerClick size={22} />,
    title: "Open the app",
    body: "From the landing page, click \u201cLaunch App\u201d. On the app screen, select \u201cVerify Video\u201d.",
  },
  {
    num: "02",
    icon: <Upload size={22} />,
    title: "Upload your video file",
    body: "Select the video file you want to verify. The app will check the recording against the blockchain automatically, with no address or certificate required.",
  },
  {
    num: "03",
    icon: <ShieldCheck size={22} />,
    title: "View your result",
    body: "The app will display whether the video has been tampered with or remains intact since the time of recording.",
  },
];

const tips = [
  { icon: <AlertCircle size={18} />, text: "Keep the original, unedited video file. Even minor modifications such as compression, trimming, re-encoding, etc. will change the file\u2019s fingerprint and may affect verification." },
];

export function InstructionsPage({ onLogoClick, onNavClick, currentScreen }) {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: brandColors.appBg, color: brandColors.offWhite }}>
      <Navbar onLogoClick={onLogoClick} onNavClick={onNavClick} currentScreen={currentScreen} />

      {/* Hero */}
      <Box
        sx={{
          pt: { xs: "120px", md: "140px" },
          pb: { xs: 8, md: 10 },
          borderBottom: `1px solid ${RULE_COLOR}`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background glow */}
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "800px",
            height: "400px",
            background: "radial-gradient(ellipse 60% 60% at 50% 0%, rgba(103,80,164,0.14) 0%, transparent 70%)",
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
                color: "rgba(139,120,193,0.7)",
                mb: 2,
                fontFamily: fontTokens.ui,
              }}
            >
              How to Use the App
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
              How to use the app
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
              Everything you need to record tamper-proof evidence or verify an existing video.
            </Typography>
          </FadeUp>
        </Container>
      </Box>

      {/* Record section */}
      <Box sx={{ py: { xs: 8, md: 12 }, borderBottom: `1px solid ${RULE_COLOR}` }}>
        <Container maxWidth="lg">
          <FadeUp>
            <Box sx={{ mb: { xs: 6, md: 8 }, textAlign: "center" }}>
              <Typography
                sx={{
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "rgba(103,80,164,0.7)",
                  mb: 2,
                  fontFamily: fontTokens.ui,
                }}
              >
                Section 1
              </Typography>
              <Typography
                variant="h2"
                sx={{
                  color: brandColors.offWhite,
                  fontWeight: 600,
                  fontSize: { xs: "2rem", md: "2.875rem" },
                  letterSpacing: "-0.035em",
                  lineHeight: 1.15,
                  mb: 1.5,
                }}
              >
                Recording evidence
              </Typography>
            </Box>
          </FadeUp>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {recordSteps.map((step, i) => (
              <FadeUp key={step.num} delay={i * 0.07}>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "64px 1fr" },
                    gap: { xs: 2, md: 4 },
                    py: { xs: 3.5, md: 4 },
                    borderBottom: i < recordSteps.length - 1 ? `1px solid ${RULE_COLOR}` : "none",
                    alignItems: "start",
                  }}
                >
                  {/* Number + icon */}
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: { xs: "flex-start", md: "center" }, gap: 1.5, pt: { md: 0.5 } }}>
                    <Typography
                      sx={{
                        fontSize: "0.875rem",
                        fontWeight: 700,
                        color: "rgba(139,120,193,0.4)",
                        letterSpacing: "0.06em",
                        fontFamily: fontTokens.ui,
                      }}
                    >
                      {step.num}
                    </Typography>
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
                      }}
                    >
                      {step.icon}
                    </Box>
                  </Box>

                  {/* Content */}
                  <Box>
                    <Typography
                      sx={{
                        fontSize: { xs: "1.125rem", md: "1.3125rem" },
                        fontWeight: 600,
                        color: brandColors.offWhite,
                        letterSpacing: "-0.02em",
                        mb: 1,
                        fontFamily: fontTokens.ui,
                      }}
                    >
                      {step.title}
                    </Typography>
                    <Typography sx={{ fontSize: "0.9375rem", color: BODY_COLOR, lineHeight: 1.75, fontFamily: fontTokens.body }}>
                      {step.body}
                    </Typography>
                  </Box>
                </Box>
              </FadeUp>
            ))}
          </Box>
        </Container>
      </Box>

      {/* Verify section */}
      <Box sx={{ py: { xs: 8, md: 12 }, borderBottom: `1px solid ${RULE_COLOR}` }}>
        <Container maxWidth="lg">
          <FadeUp>
            <Box sx={{ mb: { xs: 6, md: 8 }, textAlign: "center" }}>
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
                Section 2
              </Typography>
              <Typography
                variant="h2"
                sx={{
                  color: brandColors.offWhite,
                  fontWeight: 600,
                  fontSize: { xs: "2rem", md: "2.875rem" },
                  letterSpacing: "-0.035em",
                  lineHeight: 1.15,
                  mb: 1.5,
                }}
              >
                Verifying a video
              </Typography>
            </Box>
          </FadeUp>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {verifySteps.map((step, i) => (
              <FadeUp key={step.num} delay={i * 0.07}>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "64px 1fr" },
                    gap: { xs: 2, md: 4 },
                    py: { xs: 3.5, md: 4 },
                    borderBottom: i < verifySteps.length - 1 ? `1px solid ${RULE_COLOR}` : "none",
                    alignItems: "start",
                  }}
                >
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: { xs: "flex-start", md: "center" }, gap: 1.5, pt: { md: 0.5 } }}>
                    <Typography
                      sx={{
                        fontSize: "0.875rem",
                        fontWeight: 700,
                        color: "rgba(64,67,241,0.4)",
                        letterSpacing: "0.06em",
                        fontFamily: fontTokens.ui,
                      }}
                    >
                      {step.num}
                    </Typography>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: "10px",
                        bgcolor: "rgba(64,67,241,0.1)",
                        border: "1px solid rgba(64,67,241,0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#8B88F1",
                      }}
                    >
                      {step.icon}
                    </Box>
                  </Box>
                  <Box>
                    <Typography
                      sx={{
                        fontSize: { xs: "1.125rem", md: "1.3125rem" },
                        fontWeight: 600,
                        color: brandColors.offWhite,
                        letterSpacing: "-0.02em",
                        mb: 1,
                        fontFamily: fontTokens.ui,
                      }}
                    >
                      {step.title}
                    </Typography>
                    <Typography sx={{ fontSize: "0.9375rem", color: BODY_COLOR, lineHeight: 1.75, fontFamily: fontTokens.body }}>
                      {step.body}
                    </Typography>
                  </Box>
                </Box>
              </FadeUp>
            ))}
          </Box>
        </Container>
      </Box>

      {/* Tips */}
      <Box sx={{ py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <FadeUp>
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
              Tips
            </Typography>
            <Typography
              variant="h2"
              sx={{
                color: brandColors.offWhite,
                fontWeight: 600,
                fontSize: { xs: "2rem", md: "2.875rem" },
                letterSpacing: "-0.035em",
                lineHeight: 1.15,
                mb: { xs: 6, md: 8 },
              }}
            >
              Important to know
            </Typography>
          </FadeUp>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 2,
            }}
          >
            {tips.map((tip, i) => (
              <FadeUp key={i} delay={i * 0.08}>
                <Box
                  sx={{
                    display: "flex",
                    gap: 2,
                    p: { xs: 3, md: 3.5 },
                    borderRadius: "12px",
                    border: `1px solid ${RULE_COLOR}`,
                    bgcolor: "rgba(19,16,47,0.6)",
                    alignItems: "flex-start",
                  }}
                >
                  <Box
                    sx={{
                      flexShrink: 0,
                      mt: 0.25,
                      color: "rgba(16,185,129,0.8)",
                    }}
                  >
                    {tip.icon}
                  </Box>
                  <Typography sx={{ fontSize: "0.9375rem", color: BODY_COLOR, lineHeight: 1.7, fontFamily: fontTokens.body }}>
                    {tip.text}
                  </Typography>
                </Box>
              </FadeUp>
            ))}
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
