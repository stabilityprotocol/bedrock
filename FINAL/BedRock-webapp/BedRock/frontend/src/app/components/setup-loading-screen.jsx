"use client";

import { memo, useEffect, useId, useRef, useState } from "react";
import { Box, Typography, Button } from "@mui/material";
import { motion } from "motion/react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { brandColors } from "@/theme";
import svgPaths from "@/imports/svg-98zk994gne";

// Draw/undraw cycle (staging-final's smoother animation)
const DRAW_MS = 2200;
const UNDRAW_MS = 400;
const CYCLE_MS = DRAW_MS + UNDRAW_MS;

// Prevent perceptual "pause at fully drawn" by never reaching 100%
const MAX_PROGRESS = 0.84;

// Stroke normalization
const LOGO_PATH_LENGTH = 500;
const DASH = LOGO_PATH_LENGTH * 2;

// Subtle gradient travel (smaller = slower/subtler)
const GRADIENT_TRAVEL_MULT = 0.15;

const LOGO_VIEWBOX_WIDTH = 181;
const LOGO_VIEWBOX_HEIGHT = 154.283;

const setupSteps = [
  "Connecting to network...",
  "Deploying your secure record...",
  "Retrieving record address...",
  "Preparing camera...",
];

// Staging-final's draw/undraw SVG mask animation (smoother)
const AnimatedLoadingLogo = memo(function AnimatedLoadingLogo() {
  const uid = useId().replace(/:/g, "_");
  const gradientId = `loading-gradient-${uid}`;
  const maskId = `loading-mask-${uid}`;

  const maskStrokeRef = useRef(null);
  const gradientRef = useRef(null);

  useEffect(() => {
    let rafId = 0;
    const startedAt = performance.now();
    const travelX = LOGO_VIEWBOX_WIDTH * GRADIENT_TRAVEL_MULT;

    const clamp01 = (x) => Math.max(0, Math.min(1, x));

    const animate = (now) => {
      const elapsed = (now - startedAt) % CYCLE_MS;

      // Linear piecewise: 0->1 then 1->0 (no holds)
      let rawProgress;
      if (elapsed < DRAW_MS) {
        rawProgress = elapsed / DRAW_MS; // 0..1
      } else {
        rawProgress = 1 - (elapsed - DRAW_MS) / UNDRAW_MS; // 1..0
      }

      // Clamp and cap so we never hit fully complete (reduces perceived dwell)
      const progress = clamp01(rawProgress) * MAX_PROGRESS;

      // Reveal via mask dashoffset
      const dashoffset = DASH * (1 - progress);

      if (maskStrokeRef.current) {
        maskStrokeRef.current.style.strokeDasharray = `${DASH} ${DASH}`;
        maskStrokeRef.current.style.strokeDashoffset = `${dashoffset}`;
      }

      // Gradient motion coupled to the same progress (no wandering during plateau)
      if (gradientRef.current) {
        const gx = -travelX + 2 * travelX * progress;
        gradientRef.current.setAttribute("gradientTransform", `translate(${gx.toFixed(3)} 0)`);
      }

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <Box
      sx={{
        width: { xs: 150, md: 230 },
        mb: 4,
        isolation: "isolate",
        contain: "layout paint style",
        transform: "translateZ(0)",
        willChange: "transform",
      }}
    >
      <svg
        width="100%"
        height="100%"
        fill="none"
        viewBox={`0 0 ${LOGO_VIEWBOX_WIDTH} ${LOGO_VIEWBOX_HEIGHT}`}
        style={{ overflow: "visible" }}
      >
        <defs>
          <linearGradient
            ref={gradientRef}
            id={gradientId}
            gradientUnits="userSpaceOnUse"
            x1={0}
            y1={0}
            x2={LOGO_VIEWBOX_WIDTH}
            y2={LOGO_VIEWBOX_HEIGHT}
          >
            <stop offset="0%" stopColor={brandColors.purpleDark} />
            <stop offset="35%" stopColor={brandColors.gradientViolet} />
            <stop offset="75%" stopColor={brandColors.offWhite} />
          </linearGradient>

          <mask
            id={maskId}
            maskUnits="userSpaceOnUse"
            x={0}
            y={0}
            width={LOGO_VIEWBOX_WIDTH}
            height={LOGO_VIEWBOX_HEIGHT}
          >
            <rect x="0" y="0" width={LOGO_VIEWBOX_WIDTH} height={LOGO_VIEWBOX_HEIGHT} fill="black" />
            <path
              ref={maskStrokeRef}
              d={svgPaths.p324f8880}
              fill="none"
              stroke="white"
              strokeWidth="12"
              strokeLinejoin="round"
              strokeLinecap="round"
              pathLength={LOGO_PATH_LENGTH}
              style={{
                strokeDasharray: `${DASH} ${DASH}`,
                strokeDashoffset: `${DASH}`,
              }}
            />
          </mask>
        </defs>

        {/* Base outline */}
        <path
          d={svgPaths.p324f8880}
          stroke="rgba(137, 130, 170, 0.22)"
          strokeWidth="12"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Gradient stroke revealed by mask */}
        <path
          d={svgPaths.p324f8880}
          stroke={`url(#${gradientId})`}
          strokeWidth="12"
          strokeLinejoin="round"
          strokeLinecap="round"
          mask={`url(#${maskId})`}
        />
      </svg>
    </Box>
  );
});

export function SetupLoadingScreen({ onComplete }) {
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));

    async function runSetup() {
      setError(null);
      setActiveStep(0);
      await delay(1000);
      if (cancelled) return;

      setActiveStep(1); // real API call happens here
      let deployData;
      try {
        const res = await fetch('/api/subcontract/deploy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || res.statusText);
        deployData = body; // { subcontractAddress, deploymentBlock, signerEoa }
      } catch (err) {
        if (!cancelled) setError(err.message || String(err));
        return;
      }
      if (cancelled) return;

      setActiveStep(2);
      await delay(800);
      if (cancelled) return;

      setActiveStep(3);
      await delay(600);
      if (cancelled) return;

      setTimeout(() => {
        if (!cancelled) onComplete(deployData.subcontractAddress);
      }, 400);
    }

    runSetup();
    return () => { cancelled = true; };
  }, [onComplete, retryCount]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: brandColors.appBg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
      }}
    >
      <AnimatedLoadingLogo />

      <Typography
        variant="h3"
        sx={{
          color: brandColors.offWhite,
          textAlign: "center",
          mb: 1,
          fontSize: { xs: "1.75rem", md: "2.5rem" },
        }}
      >
        Please wait for a moment
      </Typography>

      <Typography sx={{ color: brandColors.subheader, textAlign: "center", mb: 4 }}>
        Your video anchoring is being set up.
      </Typography>

      <Box sx={{ width: "100%", maxWidth: 420 }}>
        {setupSteps.map((step, index) => {
          const isActive = index === activeStep;
          const isFailed = error !== null && index === activeStep;

          return (
            <Box
              key={step}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                mb: 2,
                opacity: isActive || isFailed ? 1 : 0.42,
                transform: isActive ? "translateX(0px) scale(1)" : "translateX(-12px) scale(0.98)",
                filter: isActive || isFailed ? "none" : "grayscale(25%)",
                transition: "opacity 420ms ease, transform 420ms ease, filter 420ms ease",
              }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  color: brandColors.white,
                  bgcolor: isFailed ? `rgba(220,38,38,0.15)` : isActive ? brandColors.gradientViolet : "transparent",
                  border: isFailed ? `1.5px solid ${brandColors.errorMain}` : isActive ? "none" : `1.5px solid ${brandColors.gray300}`,
                  boxShadow: isActive ? `0 0 16px ${brandColors.gradientViolet}8C` : "none",
                  flexShrink: 0,
                  transition: "opacity 0.3s ease, transform 0.3s ease, background-color 0.3s ease, border-color 0.3s ease",
                }}
              >
                {isFailed ? <AlertCircle size={16} color={brandColors.errorMain} /> : index + 1}
              </Box>

              <Box sx={{ flex: 1 }}>
                <Typography
                  sx={{
                    color: isFailed ? brandColors.errorMain : isActive ? brandColors.offWhite : brandColors.subheader,
                    fontWeight: isActive || isFailed ? 600 : 400,
                    transition: "color 0.3s ease, font-weight 0.3s ease",
                  }}
                >
                  {step}
                </Typography>
                {isFailed && (
                  <Typography sx={{ fontSize: "0.8125rem", color: brandColors.errorMain, opacity: 0.7, mt: 0.25 }}>
                    Setup failed: {error}
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}

        {error !== null && (
          <Button
            variant="outlined"
            startIcon={<RefreshCw size={16} />}
            onClick={() => { setError(null); setRetryCount((c) => c + 1); }}
            sx={{
              mt: 2,
              borderRadius: "100px",
              borderColor: brandColors.purpleLight,
              color: brandColors.offWhite,
              textTransform: "none",
              fontWeight: 500,
              px: 3,
              "&:hover": { bgcolor: "rgba(139,120,193,0.1)" },
            }}
          >
            Retry Setup
          </Button>
        )}
      </Box>
    </Box>
    </motion.div>
  );
}
