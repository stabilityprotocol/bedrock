import { Box, Container, Typography, TextField, Button, CircularProgress, MenuItem } from "@mui/material";
import { MessageSquare, ArrowRight, Clock, ShieldCheck, AlertCircle, Info } from "lucide-react";
import { motion, useInView } from "motion/react";
import { useRef, useState } from "react";
import emailjs from "@emailjs/browser";
import { Navbar } from "@/app/components/navbar";
import { brandColors, fontTokens } from "@/theme";

// ── EmailJS config ────────────────────────────────────────────────────────────
// Fill these in after setting up your EmailJS account (emailjs.com)
const EMAILJS_SERVICE_ID  = "YOUR_SERVICE_ID";
const EMAILJS_TEMPLATE_ID = "YOUR_TEMPLATE_ID";
const EMAILJS_PUBLIC_KEY  = "YOUR_PUBLIC_KEY";

const EMAILJS_CONFIGURED = EMAILJS_SERVICE_ID !== "YOUR_SERVICE_ID";
const CONTACT_EMAIL = "verify@bedrock.com.sg";

const BODY_COLOR = "rgba(244,238,255,0.72)";
const RULE_COLOR = "rgba(255,255,255,0.07)";
const EASE = [0.16, 1, 0.3, 1];

const SUBJECT_OPTIONS = [
  "General question",
  "Technical issue",
  "Institutional or legal enquiry",
  "Other",
];

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

const infoCards = [
  {
    icon: <Clock size={20} />,
    title: "Response time",
    body: "We typically respond within 3 business days. Urgent legal enquiries are prioritised.",
  },
  {
    icon: <ShieldCheck size={20} />,
    title: "Verification support",
    body: "If you\u2019re having trouble verifying a specific recording, include the blockchain address or certificate in your message.",
  },
];

export function ContactPage({ onLogoClick, onNavClick, currentScreen }) {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [status, setStatus] = useState("idle"); // idle | sending | success | error

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("sending");
    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          from_name: form.name,
          from_email: form.email,
          subject: form.subject,
          message: form.message,
          to_email: CONTACT_EMAIL,
        },
        EMAILJS_PUBLIC_KEY,
      );
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  const inputSx = {
    "& .MuiOutlinedInput-root": {
      borderRadius: "8px",
      bgcolor: "rgba(19,16,47,0.7)",
      color: brandColors.offWhite,
      fontSize: "0.9375rem",
      "& fieldset": { borderColor: RULE_COLOR },
      "&:hover fieldset": { borderColor: "rgba(139,120,193,0.35)" },
      "&.Mui-focused fieldset": { borderColor: brandColors.purpleLight },
      "&.Mui-disabled": {
        color: "rgba(244,238,255,0.35)",
        WebkitTextFillColor: "rgba(244,238,255,0.35)",
        "& fieldset": { borderColor: RULE_COLOR },
      },
    },
    "& .MuiInputLabel-root": {
      color: "rgba(244,238,255,0.4)",
      fontSize: "0.9375rem",
      "&.Mui-focused": { color: brandColors.purpleLight },
      "&.Mui-disabled": { color: "rgba(244,238,255,0.3)" },
    },
    "& .MuiSelect-icon": {
      color: "rgba(244,238,255,0.4)",
      "&.Mui-disabled": { color: "rgba(244,238,255,0.25)" },
    },
  };


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
            background: "radial-gradient(ellipse 60% 60% at 50% 0%, rgba(64,67,241,0.1) 0%, transparent 70%)",
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
              Contact
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
              Get in touch
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
              Have a question, a technical issue, or an enquiry about institutional access? We're here to help.
              {" "}Fill out the form below and we'll get back to you within one business day. For urgent matters related to an active legal proceeding, please indicate this in your message.
            </Typography>
          </FadeUp>
        </Container>
      </Box>

      {/* Form section */}
      <Box sx={{ py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr" },
              gap: { xs: 8, md: 10 },
              maxWidth: 680,
              mx: "auto",
            }}
          >
            {/* Form */}
            <FadeUp>
              <Box
                sx={{
                  p: { xs: 3, md: 4 },
                  borderRadius: "16px",
                  border: `1px solid ${RULE_COLOR}`,
                  bgcolor: "rgba(19,16,47,0.4)",
                  backdropFilter: "blur(8px)",
                }}
              >
                {!EMAILJS_CONFIGURED && (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 1.5,
                      p: 2,
                      mb: 3,
                      borderRadius: 2,
                      bgcolor: "rgba(103,80,164,0.1)",
                      border: "1px solid rgba(103,80,164,0.25)",
                    }}
                  >
                    <Info size={16} style={{ flexShrink: 0, marginTop: 2, color: brandColors.purpleLight }} />
                    <Typography sx={{ fontSize: "0.875rem", color: "rgba(244,238,255,0.75)", lineHeight: 1.65 }}>
                      Contact form coming soon. Email us at{" "}
                      <Box component="span" sx={{ color: brandColors.offWhite, fontWeight: 500 }}>
                        {CONTACT_EMAIL}
                      </Box>
                    </Typography>
                  </Box>
                )}

                {status === "success" ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, ease: EASE }}
                  >
                    <Box sx={{ textAlign: "center", py: 6 }}>
                      <Box
                        sx={{
                          width: 56,
                          height: 56,
                          borderRadius: "50%",
                          bgcolor: "rgba(16,185,129,0.12)",
                          border: "1px solid rgba(16,185,129,0.3)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          mx: "auto",
                          mb: 3,
                          color: brandColors.successMain,
                        }}
                      >
                        <MessageSquare size={24} />
                      </Box>
                      <Typography sx={{ fontSize: "1.25rem", fontWeight: 600, color: brandColors.offWhite, letterSpacing: "-0.02em", mb: 1.5, fontFamily: fontTokens.ui }}>
                        Message sent
                      </Typography>
                      <Typography sx={{ fontSize: "0.9375rem", color: BODY_COLOR, lineHeight: 1.7, fontFamily: fontTokens.body }}>
                        Thanks for reaching out. We'll get back to you within one business day.
                      </Typography>
                    </Box>
                  </motion.div>
                ) : (
                  <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                    <Typography sx={{ fontSize: "1.125rem", fontWeight: 600, color: brandColors.offWhite, letterSpacing: "-0.02em", mb: 0.5, fontFamily: fontTokens.ui }}>
                      Send a message
                    </Typography>

                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                      <TextField label="Full name" value={form.name} onChange={handleChange("name")} required fullWidth size="medium" disabled={!EMAILJS_CONFIGURED} sx={inputSx} />
                      <TextField label="Email address" type="email" value={form.email} onChange={handleChange("email")} required fullWidth size="medium" disabled={!EMAILJS_CONFIGURED} sx={inputSx} />
                    </Box>
                    <TextField
                      label="Subject"
                      value={form.subject}
                      onChange={handleChange("subject")}
                      required
                      fullWidth
                      size="medium"
                      select
                      disabled={!EMAILJS_CONFIGURED}
                      sx={inputSx}
                    >
                      {SUBJECT_OPTIONS.map((option) => (
                        <MenuItem key={option} value={option}>
                          {option}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField label="Message" value={form.message} onChange={handleChange("message")} required fullWidth multiline rows={5} size="medium" disabled={!EMAILJS_CONFIGURED} sx={inputSx} />

                    {status === "error" && (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: brandColors.errorMain }}>
                        <AlertCircle size={16} />
                        <Typography sx={{ fontSize: "0.875rem" }}>Something went wrong. Please try again.</Typography>
                      </Box>
                    )}

                    <Button
                      type="submit"
                      variant="contained"
                      disabled={status === "sending" || !EMAILJS_CONFIGURED}
                      endIcon={status === "sending" ? <CircularProgress size={16} sx={{ color: "inherit" }} /> : <ArrowRight size={16} />}
                      sx={{
                        borderRadius: "100px",
                        bgcolor: brandColors.purplePrimary,
                        color: brandColors.offWhite,
                        px: 3,
                        py: 1.375,
                        fontSize: "0.9375rem",
                        fontWeight: 500,
                        textTransform: "none",
                        boxShadow: "none",
                        alignSelf: "flex-start",
                        "&:hover": { bgcolor: brandColors.purpleLight, boxShadow: "none" },
                        "&:active": { bgcolor: brandColors.purpleDark },
                      }}
                    >
                      {status === "sending" ? "Sending\u2026" : "Send message"}
                    </Button>

                    <Typography sx={{ fontSize: "0.8125rem", color: "rgba(244,238,255,0.4)", lineHeight: 1.6, mt: 0.5, fontFamily: fontTokens.body }}>
                      This form is powered by EmailJS. Your information is not stored beyond what is needed to respond to your enquiry.
                    </Typography>
                  </Box>
                )}
              </Box>
            </FadeUp>

            {/* Info cards */}
            <FadeUp delay={0.1}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                  gap: 2,
                }}
              >
                {infoCards.map((card) => (
                  <Box
                    key={card.title}
                    sx={{
                      display: "flex",
                      gap: 2.5,
                      alignItems: "flex-start",
                      p: 2.5,
                      borderRadius: "12px",
                      border: `1px solid ${RULE_COLOR}`,
                      bgcolor: "rgba(19,16,47,0.5)",
                    }}
                  >
                    <Box
                      sx={{
                        flexShrink: 0,
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
                      {card.icon}
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: "0.9375rem", fontWeight: 600, color: brandColors.offWhite, mb: 0.5, fontFamily: fontTokens.ui }}>
                        {card.title}
                      </Typography>
                      <Typography sx={{ fontSize: "0.8125rem", color: BODY_COLOR, lineHeight: 1.6, fontFamily: fontTokens.body }}>
                        {card.body}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </FadeUp>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
