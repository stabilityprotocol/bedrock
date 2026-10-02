import { Box, Container, Typography, Button } from "@mui/material";
import { motion } from "motion/react";
import { Video, Search, ArrowRight } from "lucide-react";
import { Navbar } from "@/app/components/navbar";
import { brandColors } from "@/theme";

const EASE = [0.16, 1, 0.3, 1];

const options = [
  {
    icon: <Video size={28} strokeWidth={1.5} />,
    label: "Record Evidence",
    description:
      "Create a new tamper-proof video recording, hashed and anchored to the blockchain at the moment of capture.",
    cta: "Record Evidence",
    accent: brandColors.purplePrimary,
    accentGlow: "rgba(103,80,164,0.35)",
    accentBorder: "rgba(103,80,164,0.3)",
    accentBg: "rgba(103,80,164,0.1)",
  },
  {
    icon: <Search size={28} strokeWidth={1.5} />,
    label: "Verify Video",
    description:
      "Upload an existing video to verify its authenticity against the blockchain record. Results in under a minute.",
    cta: "Verify Video",
    accent: brandColors.successMain,
    accentGlow: "rgba(16,185,129,0.3)",
    accentBorder: "rgba(16,185,129,0.28)",
    accentBg: "rgba(16,185,129,0.08)",
  },
];

export function DemoScreen({ onCreateVideo, onVerifyVideo, onLogoClick }) {
  const handlers = [onCreateVideo, onVerifyVideo];

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse 80% 50% at 50% 0%, #1A1040 0%, transparent 60%), radial-gradient(circle at 50% 50%, #0C082B 0%, #09070F 100%)",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Grain */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          opacity: 0.035,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
        }}
      />

      <Navbar onLogoClick={onLogoClick} onDemoClick={undefined} inApp={true} />

      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pt: { xs: 12, md: 14 },
          pb: { xs: 8, md: 10 },
          px: { xs: 3, md: 6 },
          position: "relative",
          zIndex: 1,
        }}
      >
        <Container maxWidth="md">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <Box sx={{ textAlign: "center", mb: { xs: 6, md: 8 } }}>
              <Typography
                sx={{
                  fontSize: "0.6875rem",
                  fontWeight: 500,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "rgba(167,139,250,0.6)",
                  mb: 1.5,
                }}
              >
                Bedrock Platform
              </Typography>
              <Typography
                variant="h2"
                sx={{
                  fontSize: { xs: "2rem", md: "2.75rem" },
                  fontWeight: 700,
                  color: brandColors.offWhite,
                  letterSpacing: "-0.03em",
                  lineHeight: 1.15,
                  mb: 1.25,
                }}
              >
                Start with Bedrock.
              </Typography>
              <Typography
                sx={{
                  fontSize: { xs: "0.9375rem", md: "1.0625rem" },
                  color: "rgba(244,238,255,0.5)",
                  lineHeight: 1.7,
                }}
              >
                Choose how you'd like to use the platform.
              </Typography>
            </Box>
          </motion.div>

          {/* Option cards */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              gap: { xs: 2.5, md: 3 },
            }}
          >
            {options.map((opt, i) => (
              <motion.div
                key={opt.label}
                initial={{ opacity: 0, y: 36 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 + i * 0.08, ease: EASE }}
              >
                <Box
                  sx={{
                    background: `linear-gradient(160deg, ${brandColors.cardBgStart} 0%, ${brandColors.cardBgEnd} 100%)`,
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "16px",
                    p: { xs: 3.5, md: 4 },
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                    height: "100%",
                    transition: "border-color 0.22s, box-shadow 0.22s, transform 0.22s",
                    "&:hover": {
                      borderColor: opt.accentBorder,
                      boxShadow: `0 0 48px ${opt.accentGlow}, 0 16px 48px rgba(0,0,0,0.4)`,
                      transform: "translateY(-2px)",
                    },
                  }}
                >
                  {/* Icon */}
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: "14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: opt.accentBg,
                      border: `1px solid ${opt.accentBorder}`,
                      color: opt.accent,
                    }}
                  >
                    {opt.icon}
                  </Box>

                  {/* Text */}
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      sx={{
                        fontSize: "1.125rem",
                        fontWeight: 700,
                        color: brandColors.offWhite,
                        letterSpacing: "-0.02em",
                        mb: 1.25,
                      }}
                    >
                      {opt.label}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: "0.9375rem",
                        color: "rgba(244,238,255,0.55)",
                        lineHeight: 1.7,
                      }}
                    >
                      {opt.description}
                    </Typography>
                  </Box>

                  {/* CTA */}
                  <Button
                    variant="contained"
                    endIcon={<ArrowRight size={16} />}
                    onClick={handlers[i]}
                    fullWidth
                    sx={{
                      py: 1.5,
                      textTransform: "none",
                      fontWeight: 500,
                      fontSize: "0.9375rem",
                      bgcolor: i === 0 ? brandColors.purplePrimary : "rgba(16,185,129,0.15)",
                      color: i === 0 ? brandColors.offWhite : brandColors.successMain,
                      border: i === 1 ? `1px solid rgba(16,185,129,0.3)` : "none",
                      boxShadow:
                        i === 0
                          ? "0 4px 20px rgba(103,80,164,0.4)"
                          : "none",
                      "&:hover": {
                        bgcolor: i === 0 ? brandColors.purpleLight : "rgba(16,185,129,0.22)",
                        boxShadow:
                          i === 0
                            ? "0 6px 24px rgba(139,120,193,0.45)"
                            : "0 4px 16px rgba(16,185,129,0.2)",
                      },
                      "&:active": {
                        bgcolor: i === 0 ? brandColors.purpleDark : "rgba(16,185,129,0.1)",
                        boxShadow: "none",
                      },
                    }}
                  >
                    {opt.cta}
                  </Button>
                </Box>
              </motion.div>
            ))}
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
