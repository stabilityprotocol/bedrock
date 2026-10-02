import { Box, Container, Typography } from "@mui/material";
import { Plus, Minus } from "lucide-react";
import { motion, useInView, AnimatePresence } from "motion/react";
import { useRef, useState, useId } from "react";
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

const faqGroups = [
  {
    category: "General",
    color: "rgba(139,120,193,0.7)",
    items: [
      {
        q: "What does \u2018blockchain anchored\u2019 actually mean?",
        a: "When you record a video, the app computes a unique cryptographic hash: a short fingerprint of the file\u2019s exact contents. That hash is written to the Stability blockchain alongside a timestamp. The entry is permanent and cannot be altered. Later, when someone verifies the video, the app recomputes the hash and checks it against the blockchain record. If the file is unchanged, the hashes match. If anything has been edited, the hashes differ and the app flags it.",
      },
      {
        q: "Do I need a blockchain address to verify a video?",
        a: "No. Simply upload the video file and the app will verify it automatically.",
      },
      {
        q: "What is liveness verification and why is it required?",
        a: "Liveness verification is an anti-spoofing check that confirms a real, live person is present in front of the camera before recording begins. It prevents pre-recorded videos from being submitted as new recordings. The check typically takes a few seconds and does not require any special action beyond being present on camera.",
      },
      {
        q: "What happens if my video fails verification?",
        a: "A failed verification means the file\u2019s current fingerprint does not match the record stored on the blockchain at the time of recording. This indicates the file has been modified; whether intentionally or as a result of compression, re-encoding, or format conversion. The original, unmodified file is required for verification to pass.",
      },
      {
        q: "Is my video stored on the blockchain?",
        a: "No. The video file itself is never uploaded to the blockchain. Only the cryptographic hash (a short string derived from the file\u2019s contents) is anchored on-chain. The hash cannot be used to reconstruct or view the video. The video file itself is stored locally on your device only.",
      },
      {
        q: "What should I do after recording to preserve my evidence?",
        a: "Keep the original video file unmodified and store it alongside the certificate that is downloaded at the end of recording. Any change to the video file, however minor, will alter its fingerprint and cause verification to fail.",
      },
      {
        q: "Is the app suitable for use in legal proceedings?",
        a: "The app is built with legal and institutional use cases in mind. It produces a cryptographic record of a video\u2019s integrity at a specific point in time; evidence that the file has not been altered since recording. It does not generate legal ground truth or constitute formal legal certification. We believe in transparency: our technology is open for review, and we encourage institutions and legal professionals to evaluate it directly and consult with qualified legal counsel to determine its suitability for their specific context and jurisdiction.",
      },
    ],
  },
];

function AccordionItem({ q, a, accentColor }) {
  const [open, setOpen] = useState(false);
  const uid = useId().replace(/:/g, "_");
  const btnId = `faq-btn-${uid}`;
  const panelId = `faq-panel-${uid}`;

  return (
    <Box
      sx={{
        borderBottom: `1px solid ${RULE_COLOR}`,
        "&:last-child": { borderBottom: "none" },
      }}
    >
      <Box
        component="button"
        id={btnId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        sx={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          py: 3,
          px: 0,
          bgcolor: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <Typography
          sx={{
            fontSize: { xs: "1rem", md: "1.125rem" },
            fontWeight: 500,
            color: open ? brandColors.offWhite : "rgba(244,238,255,0.85)",
            letterSpacing: "-0.01em",
            lineHeight: 1.5,
            transition: "color 0.2s",
            fontFamily: fontTokens.ui,
          }}
        >
          {q}
        </Typography>
        <Box
          sx={{
            flexShrink: 0,
            width: 28,
            height: 28,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: open ? "rgba(103,80,164,0.18)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${open ? "rgba(103,80,164,0.3)" : RULE_COLOR}`,
            color: open ? brandColors.purpleLight : "rgba(244,238,255,0.4)",
            transition: "all 0.2s",
          }}
        >
          {open ? <Minus size={14} /> : <Plus size={14} />}
        </Box>
      </Box>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={btnId}
            key="answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            style={{ overflow: "hidden" }}
          >
            <Typography
              sx={{
                fontSize: "0.9375rem",
                color: BODY_COLOR,
                lineHeight: 1.75,
                pb: 3,
                fontFamily: fontTokens.body,
              }}
            >
              {a}
            </Typography>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}

export function FaqPage({ onLogoClick, onNavClick, currentScreen }) {
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
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "800px",
            height: "400px",
            background: "radial-gradient(ellipse 60% 60% at 50% 0%, rgba(103,80,164,0.12) 0%, transparent 70%)",
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
              Frequently Asked Questions
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
              Frequently asked questions
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: "1.0625rem", md: "1.25rem" },
                color: BODY_COLOR,
                lineHeight: 1.75,
                maxWidth: 520,
                mx: "auto",
                fontFamily: fontTokens.body,
              }}
            >
              Answers to common questions about how the app works and what blockchain anchoring means in practice.
            </Typography>
          </FadeUp>
        </Container>
      </Box>

      {/* FAQ groups */}
      <Box sx={{ py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 8, md: 12 } }}>
            {faqGroups.map((group, gi) => (
              <FadeUp key={group.category} delay={gi * 0.06}>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "200px 1fr" },
                    gap: { xs: 4, md: 8 },
                  }}
                >
                  {/* Category label */}
                  <Box sx={{ pt: { md: 1 } }}>
                    <Typography
                      sx={{
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: group.color,
                        fontFamily: fontTokens.ui,
                      }}
                    >
                      {group.category}
                    </Typography>
                  </Box>

                  {/* Accordion items */}
                  <Box
                    sx={{
                      borderTop: `1px solid ${RULE_COLOR}`,
                    }}
                  >
                    {group.items.map((item) => (
                      <AccordionItem key={item.q} q={item.q} a={item.a} accentColor={group.color} />
                    ))}
                  </Box>
                </Box>
              </FadeUp>
            ))}
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
