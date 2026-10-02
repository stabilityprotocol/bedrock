import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Loader } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import "@aws-amplify/ui-react-liveness/styles.css";
import {
  init as RecorderInit,
  start as RecorderStart,
  stop as RecorderStop,
  cleanup as RecorderCleanup,
  setLivePreview,
  getVideoBlob,
  notifyLivenessPassed,
  notifyLivenessFailed,
} from "@/lib/recording";

// ── Constants ──────────────────────────────────────────────────────────────────
const POLL_DELAY_MS = 2000;
const MAX_RESULT_ATTEMPTS = 10;
const AWS_LAYER_EXIT_MS = 280;

// ── Canvas stroke patch (module-level, ref-counted) ────────────────────────────
let canvasStrokePatchRefCount = 0;
let restoreCanvasStrokePatch = null;

function installFreshnessStrokePatch() {
  if (
    typeof window === "undefined" ||
    typeof CanvasRenderingContext2D === "undefined"
  ) {
    return () => {};
  }

  canvasStrokePatchRefCount += 1;

  if (!restoreCanvasStrokePatch) {
    const originalStroke = CanvasRenderingContext2D.prototype.stroke;
    const originalFillRect = CanvasRenderingContext2D.prototype.fillRect;

    CanvasRenderingContext2D.prototype.stroke = function patchedStroke(...args) {
      const canvasEl = this.canvas;
      const strokeStyleValue =
        typeof this.strokeStyle === "string" ? this.strokeStyle.toLowerCase() : "";
      const shouldSuppressFreshnessOvalStroke =
        canvasEl instanceof HTMLCanvasElement &&
        canvasEl.classList.contains("amplify-liveness-freshness-canvas") &&
        Number(this.lineWidth) >= 8 &&
        [
          "white",
          "#fff",
          "#ffffff",
          "rgb(255, 255, 255)",
          "rgba(255, 255, 255, 1)",
        ].includes(strokeStyleValue);

      if (shouldSuppressFreshnessOvalStroke) {
        return;
      }

      return originalStroke.apply(this, args);
    };

    CanvasRenderingContext2D.prototype.fillRect = function patchedFillRect(...args) {
      const canvasEl = this.canvas;
      const isFreshnessCanvas =
        canvasEl instanceof HTMLCanvasElement &&
        canvasEl.classList.contains("amplify-liveness-freshness-canvas");
      const shouldNormalizeFreshnessInnerOval =
        isFreshnessCanvas && Math.abs(Number(this.globalAlpha) - 0.75) < 0.001;

      if (!shouldNormalizeFreshnessInnerOval) {
        return originalFillRect.apply(this, args);
      }

      const previousAlpha = this.globalAlpha;
      this.globalAlpha = 0.9;

      try {
        return originalFillRect.apply(this, args);
      } finally {
        this.globalAlpha = previousAlpha;
      }
    };

    restoreCanvasStrokePatch = () => {
      CanvasRenderingContext2D.prototype.stroke = originalStroke;
      CanvasRenderingContext2D.prototype.fillRect = originalFillRect;
      restoreCanvasStrokePatch = null;
    };
  }

  return () => {
    canvasStrokePatchRefCount = Math.max(0, canvasStrokePatchRefCount - 1);

    if (canvasStrokePatchRefCount === 0 && restoreCanvasStrokePatch) {
      restoreCanvasStrokePatch();
    }
  };
}

// ── PhotosensitiveWarning suppression ──────────────────────────────────────────
function HiddenPhotosensitiveWarning() {
  return null;
}

const AWS_LIVENESS_COMPONENTS = {
  PhotosensitiveWarning: HiddenPhotosensitiveWarning,
};

// ── Lazy-loaded FaceLivenessDetector ───────────────────────────────────────────
const FaceLivenessDetector = lazy(async () => {
  const module = await import("@aws-amplify/ui-react-liveness");
  return { default: module.FaceLivenessDetector };
});

// ── Helpers ────────────────────────────────────────────────────────────────────
function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function formatDuration(durationMs) {
  if (!durationMs) return "00:00";
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getVideoAspectRatio(videoEl) {
  if (videoEl?.videoWidth && videoEl?.videoHeight) {
    return videoEl.videoWidth / videoEl.videoHeight;
  }
  return 0;
}

async function getRecordingStream() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser cannot access camera and microphone devices.");
  }

  return navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user",
      width: { ideal: 960 },
      height: { ideal: 720 },
      aspectRatio: { ideal: 4 / 3 },
    },
    audio: true,
  });
}

// ── Main component ─────────────────────────────────────────────────────────────
export function RecordingInterface({ subcontractAddress, onComplete, onLivenessFail }) {
  // AWS liveness flow state (ported from new_liveness_aws/App.jsx)
  const [phase, setPhase] = useState("idle");
  const [sessionId, setSessionId] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [recordingStatus, setRecordingStatus] = useState("idle");
  const [recordingError, setRecordingError] = useState("");
  const [showRecordingPreview, setShowRecordingPreview] = useState(false);
  const [recordingPreviewAspectRatio, setRecordingPreviewAspectRatio] = useState(0);
  const [recordingPreviewPlacement, setRecordingPreviewPlacement] = useState(null);
  const [showAwsLayer, setShowAwsLayer] = useState(false);
  const [awsLayerExiting, setAwsLayerExiting] = useState(false);
  const [hasTriggeredAwsStart, setHasTriggeredAwsStart] = useState(false);
  const [challengeShellSize, setChallengeShellSize] = useState(null);
  const [recordingStartTime, setRecordingStartTime] = useState(null);
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);

  // BedRock-specific state
  const [livenessStatus, setLivenessStatus] = useState("idle");
  const [isInitialized, setIsInitialized] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  // Refs (from new_liveness_aws/App.jsx)
  const recordingStreamRef = useRef(null);
  const recordingPreviewRef = useRef(null);
  const livenessViewportRef = useRef(null);
  const challengeShellRef = useRef(null);
  const challengeActionsRef = useRef(null);
  const statusStackRef = useRef(null);
  const awsLayerExitTimeoutRef = useRef(null);

  // BedRock-specific refs
  const pendingHashRecordRef = useRef(null);
  const hashSubmitChainRef = useRef(Promise.resolve());
  const recordingIdRef = useRef(null);
  const recordingStartRef = useRef(null);
  const recorderActualStartRef = useRef(null);

  // ── Derived state ──────────────────────────────────────────────────────────
  const region = import.meta.env.VITE_AWS_REGION;

  const isBusy =
    phase === "creating-session" ||
    phase === "fetching-result" ||
    recordingStatus === "preparing" ||
    recordingStatus === "stopping";
  const canStartNewSession =
    !isBusy &&
    phase !== "ready" &&
    recordingStatus !== "recording";
  const showChallengeStage = showRecordingPreview || showAwsLayer;
  const challengeStageMode =
    phase === "success" && recordingStatus === "recording"
      ? "recording-expanded"
      : phase === "fetching-result"
        ? "verifying"
        : showAwsLayer
          ? "liveness-active"
          : showRecordingPreview
            ? "recording-expanded"
            : "idle";
  const challengeStageClassName = `challenge-stage challenge-stage--${challengeStageMode}`;
  const challengeShellClassName = `challenge-shell challenge-shell--${challengeStageMode}`;
  const challengeShellStyle = challengeShellSize
    ? {
        width: `${challengeShellSize.width}px`,
        maxWidth: "100%",
        height: `${challengeShellSize.height}px`,
        minHeight: `${challengeShellSize.height}px`,
      }
    : undefined;
  const recordingPreviewMeasured = Boolean(recordingPreviewPlacement);
  const lockRecordingPreviewToAwsFrame =
    recordingPreviewMeasured && showAwsLayer;
  const showExternalAwsStartButton = showAwsLayer && phase === "ready" && !hasTriggeredAwsStart;
  const showPendingAwsStartButton = showAwsLayer && phase === "ready" && hasTriggeredAwsStart;
  const showStopRecordingButton =
    phase === "success" && recordingStatus === "recording";
  const challengeShellAspectRatio = showAwsLayer
    ? 4 / 3
    : recordingPreviewAspectRatio || 4 / 3;
  const recordingPreviewAnchorStyle = lockRecordingPreviewToAwsFrame
    ? recordingPreviewPlacement
    : recordingPreviewAspectRatio
      ? { aspectRatio: `${recordingPreviewAspectRatio}` }
      : undefined;

  // ── Recording duration timer ───────────────────────────────────────────────
  useEffect(() => {
    if (recordingStatus !== "recording" || !recordingStartTime) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setRecordingDurationMs(Date.now() - recordingStartTime);
    }, 500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [recordingStatus, recordingStartTime]);

  // ── Recording preview srcObject sync ───────────────────────────────────────
  useEffect(() => {
    const previewEl = recordingPreviewRef.current;
    const stream = recordingStreamRef.current;

    if (!previewEl) {
      return undefined;
    }

    if (showRecordingPreview && stream) {
      previewEl.srcObject = stream;
      previewEl.play().catch((playError) => {
        console.error("Recording preview play failed:", playError);
      });
    } else if (previewEl.srcObject) {
      previewEl.srcObject = null;
    }

    return () => {
      if (previewEl.srcObject) {
        previewEl.srcObject = null;
      }
    };
  }, [showRecordingPreview]);

  // ── Recording aspect ratio sync (rAF loop) ────────────────────────────────
  useEffect(() => {
    if (!showRecordingPreview || showAwsLayer) {
      return undefined;
    }

    let animationFrameId = 0;

    const syncRecordingAspectRatio = () => {
      const nextAspectRatio = getVideoAspectRatio(recordingPreviewRef.current);

      if (
        nextAspectRatio &&
        Math.abs(nextAspectRatio - recordingPreviewAspectRatio) > 0.001
      ) {
        setRecordingPreviewAspectRatio(nextAspectRatio);
      }

      animationFrameId = window.requestAnimationFrame(syncRecordingAspectRatio);
    };

    animationFrameId = window.requestAnimationFrame(syncRecordingAspectRatio);

    return () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [recordingPreviewAspectRatio, showAwsLayer, showRecordingPreview]);

  // ── AWS video anchor placement sync (rAF loop) ────────────────────────────
  useEffect(() => {
    if (!showAwsLayer) {
      return undefined;
    }

    let animationFrameId = 0;
    let lastPlacementKey = "";

    const syncPlacement = () => {
      const viewportEl = livenessViewportRef.current;
      const anchorEl = viewportEl?.querySelector(".amplify-liveness-video-anchor");

      if (viewportEl && anchorEl) {
        const viewportRect = viewportEl.getBoundingClientRect();
        const anchorRect = anchorEl.getBoundingClientRect();
        const nextPlacement = {
          width: Math.round(anchorRect.width),
          height: Math.round(anchorRect.height),
          left: Math.round(anchorRect.left - viewportRect.left),
          top: Math.round(anchorRect.top - viewportRect.top),
        };

        if (nextPlacement.width > 0 && nextPlacement.height > 0) {
          const nextPlacementKey = [
            nextPlacement.width,
            nextPlacement.height,
            nextPlacement.left,
            nextPlacement.top,
          ].join(":");

          if (nextPlacementKey !== lastPlacementKey) {
            lastPlacementKey = nextPlacementKey;
            setRecordingPreviewPlacement(nextPlacement);
          }
        }
      }

      animationFrameId = window.requestAnimationFrame(syncPlacement);
    };

    animationFrameId = window.requestAnimationFrame(syncPlacement);

    return () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [showAwsLayer]);

  // ── Canvas stroke patch ────────────────────────────────────────────────────
  useEffect(() => {
    const teardownCanvasPatch = installFreshnessStrokePatch();
    return () => {
      teardownCanvasPatch();
    };
  }, []);


// ── Force-remove hidden attribute from liveness canvases ─────────────────
// Tailwind's base layer applies `[hidden] { display: none !important }` which
// prevents the Amplify widget from showing its canvases. The widget
// toggles the HTML `hidden` attribute via JS, but Tailwind's rule overrides it.
// This observer strips `hidden` so both the oval and freshness canvases are
// always visible to the widget.
// ─────────────────────────────────────────────────────────────────────────
useEffect(() => {
  if (!showAwsLayer || !sessionId || phase !== "ready") return undefined;

  const LIVENESS_CANVAS_SELECTOR =
    "canvas.amplify-liveness-freshness-canvas, canvas.amplify-liveness-oval-canvas";

  // Small delay to ensure the FaceLivenessDetector has mounted
  const timerId = setTimeout(() => {
    const viewportEl = livenessViewportRef.current;
    if (!viewportEl){
      console.log("[LivenessCanvasObserver] viewportEl is null!");
      return;
    }

    const unhideCanvases = () => {
      const canvases = viewportEl.querySelectorAll(LIVENESS_CANVAS_SELECTOR);
      canvases.forEach((canvas) => {
        if (canvas.hasAttribute("hidden")) {
          canvas.removeAttribute("hidden");
        }
        if (canvas.style.display === "none") {
          canvas.style.display = "";
        }
      });
    };

    const observer = new MutationObserver(unhideCanvases);

    observer.observe(viewportEl, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden", "style", "class"],
    });

    // Also do an immediate check
    const canvases = viewportEl.querySelectorAll(LIVENESS_CANVAS_SELECTOR);
    console.log("[LivenessCanvasObserver] immediate check, canvases found:", canvases.length);
    unhideCanvases();

    // Store observer for cleanup
    viewportEl._freshnessObserver = observer;
  }, 500);

  return () => {
    clearTimeout(timerId);
    const viewportEl = livenessViewportRef.current;
    if (viewportEl?._freshnessObserver) {
      viewportEl._freshnessObserver.disconnect();
      viewportEl._freshnessObserver = null;
    }
  };
}, [showAwsLayer, sessionId, phase]);


  // ── Challenge shell sizing (ResizeObserver + window resize) ────────────────
  useEffect(() => {
    const shellEl = challengeShellRef.current;
    if (!shellEl) {
      return undefined;
    }

    const updateShellHeight = () => {
      const availableWidth = shellEl.parentElement?.clientWidth || shellEl.clientWidth;
      if (!availableWidth) {
        return;
      }

      const isNarrowViewport = window.matchMedia("(max-width: 760px)").matches;
      const viewportHeight =
        window.innerHeight || document.documentElement.clientHeight || 0;
      const shellTop = shellEl.getBoundingClientRect().top;
      const panelEl = shellEl.closest(".challenge-panel");
      const panelBottomPadding = panelEl
        ? parseFloat(window.getComputedStyle(panelEl).paddingBottom || "0")
        : 0;
      const actionsHeight = challengeActionsRef.current?.offsetHeight || 0;
      const actionsMarginTop = challengeActionsRef.current
        ? parseFloat(
            window.getComputedStyle(challengeActionsRef.current).marginTop || "0"
          )
        : 0;
      const statusHeight = statusStackRef.current?.offsetHeight || 0;
      const statusMarginTop =
        statusHeight > 0 && statusStackRef.current
          ? parseFloat(window.getComputedStyle(statusStackRef.current).marginTop || "0")
          : 0;
      const availableHeight = Math.floor(
        viewportHeight -
          shellTop -
          panelBottomPadding -
          actionsMarginTop -
          actionsHeight -
          statusMarginTop -
          statusHeight -
          8
      );
      const widthBasedHeight = Math.round(
        availableWidth / challengeShellAspectRatio
      );
      const maxHeight = isNarrowViewport ? 560 : 820;
      const fittedHeight = Math.min(maxHeight, widthBasedHeight, availableHeight);
      const nextHeight = Math.max(
        isNarrowViewport ? 180 : 220,
        Number.isFinite(fittedHeight) ? fittedHeight : widthBasedHeight
      );
      const nextWidth = Math.min(
        availableWidth,
        Math.round(nextHeight * challengeShellAspectRatio)
      );

      setChallengeShellSize((currentSize) =>
        currentSize &&
        currentSize.width === nextWidth &&
        currentSize.height === nextHeight
          ? currentSize
          : { width: nextWidth, height: nextHeight }
      );
    };

    updateShellHeight();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateShellHeight);
      return () => {
        window.removeEventListener("resize", updateShellHeight);
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      updateShellHeight();
    });
    resizeObserver.observe(shellEl);
    window.addEventListener("resize", updateShellHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateShellHeight);
    };
  }, [
    challengeShellAspectRatio,
    challengeStageMode,
    error,
    infoMessage,
    phase,
    recordingError,
    showChallengeStage,
    showExternalAwsStartButton,
  ]);

  // ── Initialize BedRock recorder on mount ───────────────────────────────────
  useEffect(() => {
    RecorderInit({
      livePreview: recordingPreviewRef.current,
      outPreview: null,
      btnStart: null,
      btnStop: null,
      btnDownload: null,

      onLivenessStatus: (s) => setLivenessStatus(s),
      onLivenessPass: () => {},    // handled by AWS flow
      onLivenessFail: () => {},    // handled by AWS flow

      onHashRecord: async (record) => {
        if (!recordingIdRef.current || !subcontractAddress) return;
        // Submit the PREVIOUS hash, chained sequentially so on-chain order matches segment order.
        if (pendingHashRecordRef.current) {
          const toSubmit = { ...pendingHashRecordRef.current, isFinalHash: false };
          hashSubmitChainRef.current = hashSubmitChainRef.current.then(() =>
            fetch("/api/hashes/submit", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                recordingId: recordingIdRef.current,
                subcontractAddress,
                hashes: [toSubmit],
              }),
            }).catch((err) => console.error("[hash submit] seg=" + toSubmit.index, err.message))
          );
        }
        pendingHashRecordRef.current = record;
      },

      onHashesReady: async () => {
        if (!pendingHashRecordRef.current || !recordingIdRef.current || !subcontractAddress) return;
        // Submit the last hash with isFinalHash: true, after all previous submits complete.
        const finalRecord = { ...pendingHashRecordRef.current, isFinalHash: true };
        const finalHashHex = finalRecord.rollingHex;
        await (hashSubmitChainRef.current = hashSubmitChainRef.current.then(() =>
          fetch("/api/hashes/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recordingId: recordingIdRef.current,
              subcontractAddress,
              hashes: [finalRecord],
            }),
          }).catch((err) => console.error("[final hash submit]", err.message))
        ));
        pendingHashRecordRef.current = null;

        const duration = Math.round((Date.now() - recorderActualStartRef.current) / 1000);
        const timestamp = new Date()
          .toLocaleString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
          .toUpperCase();
        const videoBlob = getVideoBlob();
        onComplete(timestamp, duration, finalHashHex, videoBlob, recordingStartRef.current);
      },

      onFinalHash: () => {},
      onTimingSummary: () => {},
      onLogAppend: (l) => console.log("[Recorder]", l),
      onLogReplace: () => {},
    });

    setIsInitialized(true);

    return () => {
      clearAwsLayerExitTimeout();
      if (recordingStreamRef.current) {
        recordingStreamRef.current.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
      }
      RecorderCleanup();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── AWS layer exit helpers ─────────────────────────────────────────────────
  function startAwsLayerExit() {
    clearAwsLayerExitTimeout();
    setAwsLayerExiting(true);
    awsLayerExitTimeoutRef.current = window.setTimeout(() => {
      setShowAwsLayer(false);
      setAwsLayerExiting(false);
      awsLayerExitTimeoutRef.current = null;
    }, AWS_LAYER_EXIT_MS);
  }

  function clearAwsLayerExitTimeout() {
    if (awsLayerExitTimeoutRef.current) {
      window.clearTimeout(awsLayerExitTimeoutRef.current);
      awsLayerExitTimeoutRef.current = null;
    }
  }

  // ── Trigger AWS "Begin check" button programmatically ──────────────────────
  async function triggerAwsStartButton() {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const buttonEl = livenessViewportRef.current?.querySelector(
        ".liveness-detector-check > .amplify-flex:last-child .amplify-button"
      );

      if (buttonEl) {
        buttonEl.click();
        setHasTriggeredAwsStart(true);
        return;
      }

      await delay(100);
    }

    setError("The AWS start button is not ready yet. Wait a moment and try again.");
  }

  // ── Recording preview metadata handler ─────────────────────────────────────
  function handleRecordingPreviewMetadata(event) {
    const nextAspectRatio = getVideoAspectRatio(event.currentTarget);
    if (nextAspectRatio) {
      setRecordingPreviewAspectRatio(nextAspectRatio);
    }
  }

  // ── Start liveness check (main flow entry point) ───────────────────────────
  async function startLivenessCheck() {
    setPhase("creating-session");
    setError("");
    setInfoMessage("Preparing recording and liveness session...");
    setRecordingError("");
    setRecordingStatus("preparing");

    recordingIdRef.current = Date.now().toString();
    pendingHashRecordRef.current = null;
    hashSubmitChainRef.current = Promise.resolve();

    try {
      // Stream A — for MediaRecorder (recording)
      const mediaStream = await getRecordingStream();
      recordingStreamRef.current = mediaStream;
      setRecordingPreviewAspectRatio(0);

      // Mount the video element first so recordingPreviewRef is available
      setShowRecordingPreview(true);
      setShowAwsLayer(true);

      // Wait one frame for React to render the <video> and populate the ref
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      // Update the livePreview reference in recording.js now that the element exists
      setLivePreview(recordingPreviewRef.current);

      // Pass Stream A to recording.js as an external stream
      await RecorderStart(mediaStream);
      recorderActualStartRef.current = Date.now();

      // Create AWS liveness session
      const response = await fetch("/api/liveness/session", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Failed to create a liveness session.");
      }

      setSessionId(data.sessionId);
      setRecordingStatus("recording");
      setRecordingDurationMs(0);
      setAwsLayerExiting(false);
      setHasTriggeredAwsStart(false);
      setPhase("ready");
      setInfoMessage("");
      setCameraReady(true);
    } catch (startupError) {
      console.error("startLivenessCheck error:", startupError);
      // Cleanup on failure
      if (recordingStreamRef.current) {
        recordingStreamRef.current.getTracks().forEach((t) => t.stop());
        recordingStreamRef.current = null;
      }
      setPhase("error");
      setRecordingStatus("error");
      setRecordingError(startupError.message || "Recording setup failed.");
      setError(startupError.message || "Failed to start the liveness flow.");
      setInfoMessage("");
    }
  }

  // ── AWS analysis complete handler ──────────────────────────────────────────
  async function handleAnalysisComplete() {
    setPhase("fetching-result");
    setError("");
    setInfoMessage("Analysis complete. Fetching the Rekognition result...");

    try {
      const finalResult = await pollForResult(sessionId);
      setResult(finalResult);

      if (finalResult.isLive) {
        // Liveness passed — notify recording.js and exit AWS overlay
        await notifyLivenessPassed({
          score: finalResult.confidence / 100,
          result: "real",
        });
        recordingStartRef.current = Date.now();
        setRecordingStartTime(Date.now());
        setPhase("success");
        startAwsLayerExit();
        setInfoMessage("");
        return;
      }

      // Liveness failed — stop recording and navigate to failure screen
      notifyLivenessFailed();
      RecorderStop();
      if (recordingStreamRef.current) {
        recordingStreamRef.current.getTracks().forEach((t) => t.stop());
        recordingStreamRef.current = null;
      }
      setPhase("failure");
      setRecordingStatus("idle");
      setShowRecordingPreview(false);
      setShowAwsLayer(false);
      setError("Liveness check failed. Recording was stopped and discarded.");
      setInfoMessage("");
      if (onLivenessFail) onLivenessFail();
    } catch (resultError) {
      notifyLivenessFailed();
      RecorderStop();
      if (recordingStreamRef.current) {
        recordingStreamRef.current.getTracks().forEach((t) => t.stop());
        recordingStreamRef.current = null;
      }
      setPhase("error");
      setRecordingStatus("idle");
      setShowRecordingPreview(false);
      setShowAwsLayer(false);
      setError(resultError.message || "Failed to fetch liveness result.");
      setRecordingError(
        "Recording was stopped because the liveness result could not be finalized."
      );
      setInfoMessage("");
      if (onLivenessFail) onLivenessFail();
    }
  }

  // ── AWS detector error handler ─────────────────────────────────────────────
  async function handleDetectorError(detectorError) {
    console.error("Face liveness detector error:", detectorError);
    notifyLivenessFailed();
    RecorderStop();
    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach((t) => t.stop());
      recordingStreamRef.current = null;
    }
    setPhase("error");
    setRecordingStatus("idle");
    setShowRecordingPreview(false);
    setShowAwsLayer(false);
    setError(
      detectorError?.message ||
        "The liveness detector failed. Recording was stopped and discarded."
    );
    setRecordingError("Recording was stopped because the liveness detector failed.");
    setInfoMessage("");
    if (onLivenessFail) onLivenessFail();
  }

  // ── Stop and save recording (after liveness passes) ────────────────────────
  function stopAndSaveRecording() {
    setRecordingStatus("stopping");
    setInfoMessage("Stopping recording...");
    // RecorderStop triggers onstop → onHashesReady → onComplete
    RecorderStop();
    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach((t) => t.stop());
      recordingStreamRef.current = null;
    }
    setShowRecordingPreview(false);
    setRecordingStatus("idle");
    setInfoMessage("");
  }

  // ── Poll for liveness result ───────────────────────────────────────────────
  async function pollForResult(currentSessionId) {
    for (let attempt = 1; attempt <= MAX_RESULT_ATTEMPTS; attempt += 1) {
      const response = await fetch(
        `/api/liveness/session/${currentSessionId}/result`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Failed to fetch the liveness result.");
      }

      if (data.isTerminal) {
        return data;
      }

      setInfoMessage(
        `Result not ready yet (status: ${data.status}). Retrying ${attempt}/${MAX_RESULT_ATTEMPTS}...`
      );
      await delay(POLL_DELAY_MS);
    }

    throw new Error("Timed out while waiting for the liveness result.");
  }

  // ── Build challenge content JSX ────────────────────────────────────────────
  const showActionRow =
    canStartNewSession ||
    showExternalAwsStartButton ||
    showPendingAwsStartButton ||
    showStopRecordingButton;

  let challengeContent;

  if (isBusy && !showChallengeStage) {
    challengeContent = (
      <div ref={challengeShellRef} style={challengeShellStyle} className="challenge-shell">
        <div className="loader-wrap">
          <Loader size="large" />
        </div>
      </div>
    );
  } else if (showChallengeStage) {
    challengeContent = (
      <div
        ref={challengeShellRef}
        style={challengeShellStyle}
        className={challengeShellClassName}
      >
        <div className={challengeStageClassName}>
          {showRecordingPreview ? (
            <div
              className={`challenge-card challenge-card--recording ${
                challengeStageMode === "recording-expanded"
                  ? "challenge-card--expanded"
                  : "challenge-card--underlay"
              }`}
            >
              <div className="challenge-card-body challenge-card-body--recording">
                <div className="recording-preview-frame">
                  <div
                    className={`recording-preview-anchor ${
                      lockRecordingPreviewToAwsFrame
                        ? "recording-preview-anchor--measured"
                        : ""
                    }`}
                    style={recordingPreviewAnchorStyle}
                  >
                    <video
                      ref={recordingPreviewRef}
                      className="recording-preview-video"
                      autoPlay
                      muted
                      playsInline
                      onLoadedMetadata={handleRecordingPreviewMetadata}
                    />
                    <div className="recording-video-hud">
                      <div className="recording-chip recording-chip--rec">
                        <span className="recording-dot" />
                        <span>REC</span>
                      </div>
                      <div className="recording-chip recording-chip--timer">
                        {formatDuration(recordingDurationMs)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {showAwsLayer ? (
            <div
              className={`challenge-card challenge-card--liveness ${
                awsLayerExiting ? "challenge-card--exiting" : ""
              }`}
            >
              {sessionId && phase === "ready" ? (
                <Suspense
                  fallback={
                    <div className="challenge-card-body challenge-card-body--loading">
                      <Loader size="large" />
                    </div>
                  }
                >
                  <div className="challenge-card-body challenge-card-body--liveness">
                    <div
                      className={`liveness-viewport ${
                        showExternalAwsStartButton
                          ? "liveness-viewport--external-start"
                          : ""
                      }`}
                      ref={livenessViewportRef}
                    >
                      <FaceLivenessDetector
                        sessionId={sessionId}
                        region={region}
                        components={AWS_LIVENESS_COMPONENTS}
                        onAnalysisComplete={handleAnalysisComplete}
                        onError={handleDetectorError}
                      />
                    </div>
                  </div>
                </Suspense>
              ) : (
                <div className="challenge-card-body challenge-card-body--loading">
                  <Loader size="large" />
                  <p className="challenge-helper-text">
                    {phase === "fetching-result"
                      ? "Finalizing AWS liveness result..."
                      : "Connecting to the Rekognition liveness widget..."}
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    );
  } else if (phase === "idle" || phase === "error" || phase === "failure") {
    challengeContent = (
      <div
        ref={challengeShellRef}
        style={challengeShellStyle}
        className="challenge-shell challenge-shell--framed"
      >
        <div className="empty-state">
          {phase === "failure" ? (
            <div className="completion-state">
              <p className="completion-title">Liveness failed</p>
              <p>
                Recording stopped automatically and the partial clip was discarded.
              </p>
            </div>
          ) : phase === "error" ? (
            <div className="completion-state">
              <p className="completion-title">Flow interrupted</p>
              <p>
                Resolve the error, then start a fresh liveness session with a new
                recording.
              </p>
            </div>
          ) : (
            <p>
              Click &ldquo;Start Recording&rdquo; to begin concurrent recording and
              load the Rekognition liveness widget.
            </p>
          )}
        </div>
      </div>
    );
  } else {
    challengeContent = (
      <div
        ref={challengeShellRef}
        style={challengeShellStyle}
        className="challenge-shell challenge-shell--framed"
      >
        <div className="empty-state">
          <div className="completion-state">
            <p className="completion-title">Recording finished</p>
            <p>Your recording is being finalized.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="aws-liveness-root" style={{ minHeight: "100vh", background: "#0C0A17" }}>
      <section className="panel challenge-panel">
        <header className="panel-header">
          <div>
            <p className="panel-label">Evidence recording</p>
          </div>
        </header>

        {challengeContent}

        {showActionRow ? (
          <div ref={challengeActionsRef} className="challenge-actions">
            {canStartNewSession ? (
              <button
                className="primary-button"
                onClick={startLivenessCheck}
                disabled={!isInitialized}
              >
                {isBusy ? "Preparing..." : "Start Recording"}
              </button>
            ) : null}
            {showExternalAwsStartButton ? (
              <button className="secondary-button" onClick={triggerAwsStartButton}>
                Start Liveness Check
              </button>
            ) : null}
            {showPendingAwsStartButton ? (
              <button className="secondary-button" disabled>
                Start Liveness Check
              </button>
            ) : null}
            {showStopRecordingButton ? (
              <button className="primary-button" onClick={stopAndSaveRecording}>
                Stop Recording
              </button>
            ) : null}
          </div>
        ) : null}

        <div ref={statusStackRef} className="status-stack">
          {infoMessage ? <p className="info-text">{infoMessage}</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
          {recordingError ? <p className="error-text">{recordingError}</p> : null}
        </div>
      </section>
    </div>
  );
}
