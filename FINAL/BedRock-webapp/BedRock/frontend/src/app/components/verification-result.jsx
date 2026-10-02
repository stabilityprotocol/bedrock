import { useState } from "react";
import {
  Box,
  Container,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Divider,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
} from "@mui/material";
import { motion } from "motion/react";
import {
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ArrowLeft,
  AlertTriangle,
  AlertCircle,
  Clock,
  Blocks,
  User,
  Fingerprint,
  ChevronDown,
  Copy,
  Check,
  Download,
} from "lucide-react";
import { brandColors } from "@/theme";
import { Navbar } from "@/app/components/navbar";

/** Truncate a hex hash for display: 0xabcdef...123456 */
function truncateHash(hash, chars = 8) {
  if (!hash || hash.length <= chars * 2 + 2) return hash || '-';
  return hash.slice(0, chars + 2) + '...' + hash.slice(-chars);
}

/** Format bytes into human-readable string */
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/** Segment timeline visualization */
function SegmentTimeline({ totalSegments, divergenceIndex, approximateSecond }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" sx={{ mb: 1.5, color: brandColors.offWhite, fontWeight: 600 }}>
        Segment Analysis
      </Typography>

      {/* Timeline bar */}
      <Box
        sx={{
          display: 'flex',
          gap: '2px',
          mb: 1.5,
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        {Array.from({ length: totalSegments }, (_, i) => {
          const isMatch = i < divergenceIndex;
          const isDivergent = i === divergenceIndex;
          const isAfter = i > divergenceIndex;

          return (
            <Box
              key={i}
              sx={{
                flex: 1,
                height: 28,
                minWidth: 4,
                bgcolor: isMatch
                  ? brandColors.successMain
                  : isDivergent
                    ? brandColors.errorMain
                    : isAfter
                      ? 'rgba(220, 38, 38, 0.25)'
                      : brandColors.interactiveOverlay,
                position: 'relative',
                transition: 'all 0.3s ease',
                cursor: 'default',
                '&:hover': {
                  opacity: 0.85,
                  transform: 'scaleY(1.15)',
                },
                ...(isDivergent && {
                  boxShadow: '0 0 8px rgba(220, 38, 38, 0.6)',
                  zIndex: 2,
                }),
              }}
              title={
                isDivergent
                  ? `Segment ${i}: TAMPERED${approximateSecond != null ? ` (~${approximateSecond}s)` : ''}`
                  : isMatch
                    ? `Segment ${i}: OK`
                    : `Segment ${i}: affected by earlier tampering`
              }
            />
          );
        })}
      </Box>

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: brandColors.successMain }} />
          <Typography variant="caption" sx={{ color: brandColors.gray300 }}>Verified</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: brandColors.errorMain }} />
          <Typography variant="caption" sx={{ color: brandColors.gray300 }}>Tampered</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: 'rgba(220, 38, 38, 0.25)' }} />
          <Typography variant="caption" sx={{ color: brandColors.gray300 }}>Cascade-affected</Typography>
        </Box>
      </Box>
    </Box>
  );
}

/** Format seconds to MM:SS */
function formatTime(seconds) {
  if (seconds == null) return '-';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

/** Detail row used in info sections */
function DetailRow({ label, value, mono, color }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
      <Typography variant="body2" sx={{ color: brandColors.gray300, flexShrink: 0, mr: 2 }}>
        {label}
      </Typography>
      <Typography
        variant={mono ? "caption" : "body2"}
        sx={{
          fontFamily: mono ? "monospace" : "inherit",
          textAlign: "right",
          wordBreak: "break-all",
          maxWidth: "65%",
          fontWeight: 500,
          color: color || brandColors.offWhite,
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

/** Styled Accordion for technical details sections */
const technicalAccordionSx = {
  bgcolor: brandColors.surfaceOverlay,
  border: "1px solid",
  borderColor: brandColors.surfaceBorder,
  borderRadius: '8px !important',
  '&:before': { display: 'none' },
  '& .MuiAccordionSummary-root': {
    color: brandColors.offWhite,
    minHeight: 48,
    '&.Mui-expanded': { minHeight: 48 },
  },
  '& .MuiAccordionSummary-content': {
    margin: '12px 0',
    '&.Mui-expanded': { margin: '12px 0' },
  },
  '& .MuiAccordionSummary-expandIconWrapper': {
    color: brandColors.gray300,
  },
};

/** Copy-to-clipboard button with "Copied!" feedback */
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silently fail if clipboard is not available
    }
  };

  return (
    <IconButton
      size="small"
      onClick={handleCopy}
      sx={{
        ml: 0.5,
        color: copied ? brandColors.successMain : brandColors.gray300,
        '&:hover': { bgcolor: brandColors.interactiveOverlayHover },
      }}
      title={copied ? "Copied!" : "Copy to clipboard"}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </IconButton>
  );
}

/**
 * Lets the user download the clean portion of a tampered video.
 *
 * Slices the original file at the exact divergenceByteOffset (= divergenceSegmentIndex × SEG_SIZE).
 * This is byte-identical to the first N segments of the original recording, so the
 * rolling hash chain of the downloaded file will match the blockchain record for those segments.
 */
function TrimDownload({ videoFile, divergenceByteOffset }) {
  const [done, setDone] = useState(false);

  const canExport = divergenceByteOffset > 0;

  function handleExport() {
    if (!canExport) return;
    // Byte-identical slice up to the exact segment boundary — no re-encoding.
    const trimmedBlob = videoFile.slice(0, divergenceByteOffset, videoFile.type || 'video/mp4');
    const ext = (videoFile.type || '').includes('mp4') ? 'mp4' : 'webm';
    const url = URL.createObjectURL(trimmedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bedrock_verified_portion.${ext}`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setDone(true);
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" sx={{ mb: 1.5, color: brandColors.offWhite, fontWeight: 600 }}>
        Download Untampered Portion
      </Typography>

      <Tooltip
        title={!canExport ? 'Tampering begins at segment 0 — no untampered content available' : ''}
        placement="top"
      >
        <span>
          <Button
            variant="outlined"
            fullWidth
            disabled={!canExport}
            onClick={handleExport}
            startIcon={done ? <Check size={16} /> : <Download size={16} />}
            sx={{
              py: 1.375,
              borderWidth: 2,
              borderColor: canExport ? brandColors.successMain : undefined,
              color: canExport ? brandColors.successMain : undefined,
              '&:hover': {
                borderWidth: 2,
                borderColor: canExport ? brandColors.successMain : undefined,
                bgcolor: canExport ? 'rgba(34,197,94,0.08)' : undefined,
              },
              '&.Mui-disabled': { borderWidth: 2 },
            }}
          >
            {done ? 'Re-download Untampered Portion' : 'Download Untampered Portion'}
          </Button>
        </span>
      </Tooltip>

      {!canExport && (
        <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: brandColors.gray300 }}>
          Tampering detected at segment 0 — there is no clean content to export.
        </Typography>
      )}
      {canExport && (
        <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: brandColors.gray300 }}>
          Contains all byte-verified content. The player may report a slightly longer duration because fragmented MP4 recordings pre-buffer audio ahead of video.
        </Typography>
      )}
    </Box>
  );
}

export function VerificationResult({ result, videoFile, onBack, onVerifyAnother }) {
  // Handle error state
  if (result.error) {
    const isNotFound = !!result.hint;

    return (
      <ResultShell onBack={onBack}>
        <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }}>
          <Box
            sx={{
              width: { xs: 80, md: 96 }, height: { xs: 80, md: 96 },
              bgcolor: isNotFound ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              border: "2px solid", borderColor: brandColors.warningMain,
              borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {isNotFound
              ? <AlertCircle size={56} color={brandColors.warningMain} />
              : <AlertTriangle size={56} color={brandColors.warningMain} />
            }
          </Box>
        </Box>
        <Box sx={{ textAlign: "center", mb: 4 }}>
          <Typography variant="h2" sx={{ mb: 1.5, fontSize: { xs: "2rem", md: "2.5rem" }, fontWeight: 700, color: brandColors.warningMain }}>
            {isNotFound ? "No Blockchain Record Found" : "Verification Error"}
          </Typography>
          <Typography variant="h5" sx={{ color: brandColors.offWhite }}>
            {isNotFound ? result.error : "Could not complete verification"}
          </Typography>
        </Box>

        {isNotFound ? (
          <Box sx={{ mb: 4 }}>
            <Alert severity="warning" sx={{ mb: 2, bgcolor: brandColors.warningSurface, border: "2px solid", borderColor: brandColors.warningMain }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Possible causes:</Typography>
              <Typography variant="body2" component="div">
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li>The video was modified at the very beginning (segment 0), which changes the identity hash used to look up the blockchain record.</li>
                  <li>The recording is still being written to the blockchain. If you just recorded this, wait a minute and try again.</li>
                </ul>
              </Typography>
            </Alert>
          </Box>
        ) : (
          <Alert severity="warning" sx={{ mb: 4, bgcolor: brandColors.warningSurface, border: "2px solid", borderColor: brandColors.warningMain }}>
            <Typography variant="body2">{result.error}</Typography>
          </Alert>
        )}

        <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 2 }}>
          <Button variant="outlined" onClick={onBack} fullWidth sx={{ py: 1.5, borderWidth: 2, "&:hover": { borderWidth: 2 } }}>
            Back to Home
          </Button>
          {!isNotFound && onVerifyAnother && (
            <Button variant="contained" onClick={onVerifyAnother} fullWidth sx={{ py: 1.5 }}>
              Try Another Video
            </Button>
          )}
        </Box>
      </ResultShell>
    );
  }

  const {
    verified,
    calculatedFinalHash,
    onChainFinalHash,
    totalSegments,
    totalOnChainEntries,
    partialFile,
    subcontractInfo,
    tampering,
  } = result;

  return (
    <ResultShell onBack={onBack}>
      {/* Verdict Icon */}
      <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }}>
        <Box
          sx={{
            width: { xs: 80, md: 96 }, height: { xs: 80, md: 96 },
            bgcolor: partialFile ? "warning.light" : verified ? "success.light" : "error.light",
            border: "2px solid",
            borderColor: partialFile ? brandColors.warningMain : verified ? brandColors.successMain : brandColors.errorMain,
            borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {partialFile ? (
            <AlertTriangle size={56} color={brandColors.warningMain} />
          ) : verified ? (
            <ShieldCheck size={56} color={brandColors.successMain} />
          ) : (
            <XCircle size={56} color={brandColors.errorMain} />
          )}
        </Box>
      </Box>

      {/* Verdict Title */}
      <Box sx={{ textAlign: "center", mb: 4 }}>
        <Typography
          variant="h2"
          sx={{
            mb: 1.5,
            fontSize: { xs: "2.5rem", md: "3rem" },
            fontWeight: 700,
            color: partialFile ? brandColors.warningMain : verified ? "success.main" : "error.main",
          }}
        >
          {partialFile ? "Partial Video" : verified ? "Verified" : "Tampered"}
        </Typography>
        <Typography variant="h5" sx={{ color: brandColors.offWhite }}>
          {partialFile
            ? "Untampered Portion of a Tampered Video"
            : verified
              ? "Video is Authentic"
              : "Video Has Been Modified"}
        </Typography>
      </Box>

      {/* Verdict Alert */}
      {partialFile ? (
        <Alert
          severity="warning"
          icon={<AlertTriangle size={24} />}
          sx={{
            mb: 3,
            bgcolor: brandColors.warningSurface,
            border: "2px solid",
            borderColor: brandColors.warningMain,
            "& .MuiAlert-icon": { color: brandColors.warningMain },
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
            Partial Recording Detected
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {`This file contains ${totalSegments} of ${totalOnChainEntries} segments from a recording made through our platform. The ${totalSegments} segment${totalSegments !== 1 ? 's' : ''} present in this file ${totalSegments !== 1 ? 'are' : 'is'} untampered and match${totalSegments === 1 ? 'es' : ''} the original blockchain record.`}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {`However, this is not the complete video. The remaining ${totalOnChainEntries - totalSegments} segment${totalOnChainEntries - totalSegments !== 1 ? 's' : ''} from the original recording ${totalOnChainEntries - totalSegments !== 1 ? 'are' : 'is'} missing from this file.`}
          </Typography>
        </Alert>
      ) : (
        <Alert
          severity={verified ? "success" : "error"}
          icon={verified ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
          sx={{
            mb: 3,
            bgcolor: verified ? brandColors.successSurface : brandColors.errorSurface,
            border: "2px solid",
            borderColor: verified ? brandColors.successMain : brandColors.errorMain,
            "& .MuiAlert-icon": {
              color: verified ? brandColors.successDark : brandColors.errorDark,
            },
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
            {verified ? "Blockchain Verification Successful" : "Tampering Detected"}
          </Typography>
          <Typography variant="body2">
            {verified
              ? `All ${totalSegments} segments match the blockchain record. This video has not been modified.`
              : tampering?.segmentStartSecond != null
                ? `Modification detected in segment ${tampering.divergenceSegmentIndex} (${formatTime(tampering.segmentStartSecond)} to ${formatTime(tampering.segmentEndSecond)}). This segment and all subsequent content no longer match the original blockchain record.`
                : 'Modification detected. The content does not match the original blockchain record.'}
          </Typography>
        </Alert>
      )}

      {/* Partial Video: Segment Analysis timeline */}
      {partialFile && (
        <Box
          sx={{
            bgcolor: brandColors.surfaceOverlay,
            border: "1px solid",
            borderColor: brandColors.warningMain,
            borderRadius: 2,
            p: 3,
            mb: 3,
          }}
        >
          <Typography variant="subtitle2" sx={{ mb: 1.5, color: brandColors.offWhite, fontWeight: 600 }}>
            {`Segment Analysis — ${totalSegments} of ${totalOnChainEntries} segments present`}
          </Typography>
          <Box sx={{ display: "flex", gap: "2px", mb: 1.5, borderRadius: 1, overflow: "hidden" }}>
            {Array.from({ length: totalOnChainEntries }, (_, i) => {
              const isPresent = i < totalSegments;
              return (
                <Box
                  key={i}
                  sx={{
                    flex: 1,
                    height: 28,
                    minWidth: 4,
                    bgcolor: isPresent ? brandColors.successMain : "rgba(245, 158, 11, 0.25)",
                    transition: "all 0.3s ease",
                    cursor: "default",
                    "&:hover": { opacity: 0.85, transform: "scaleY(1.15)" },
                  }}
                  title={isPresent ? `Segment ${i}: Verified` : `Segment ${i}: Missing from file`}
                />
              );
            })}
          </Box>
          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: brandColors.successMain }} />
              <Typography variant="caption" sx={{ color: brandColors.gray300 }}>
                {`Verified (${totalSegments})`}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: "rgba(245, 158, 11, 0.25)" }} />
              <Typography variant="caption" sx={{ color: brandColors.gray300 }}>
                {`Missing (${totalOnChainEntries - totalSegments})`}
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      {/* Partial Video: Technical Details */}
      {partialFile && (
        <Accordion disableGutters elevation={0} sx={{ ...technicalAccordionSx, mb: 3 }}>
          <AccordionSummary expandIcon={<ChevronDown size={20} />}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Technical Details
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5, color: brandColors.offWhite, fontWeight: 600 }}>
              <Fingerprint size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              File Analysis
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 2 }}>
              <DetailRow label="Segments in File:" value={totalSegments} />
              <DetailRow label="Segments On-Chain:" value={totalOnChainEntries} color={brandColors.warningMain} />
              <DetailRow
                label="Missing Segments:"
                value={`${totalOnChainEntries - totalSegments} (segment${totalOnChainEntries - totalSegments !== 1 ? 's' : ''} ${totalSegments} to ${totalOnChainEntries - 1})`}
                color={brandColors.warningMain}
              />
              <DetailRow label="File Final Hash:" value={truncateHash(calculatedFinalHash, 10)} mono />
              <DetailRow label="On-Chain Final Hash:" value={truncateHash(onChainFinalHash, 10)} mono />
            </Box>
            {subcontractInfo && (
              <>
                <Divider sx={{ mb: 2, borderColor: brandColors.surfaceBorder }} />
                <Typography variant="subtitle2" sx={{ mb: 1.5, color: brandColors.offWhite, fontWeight: 600 }}>
                  <Blocks size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                  Subcontract Details
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  <DetailRow label="Authorized Child:" value={subcontractInfo.isAuthorizedChild ? 'Yes' : 'No'} color={subcontractInfo.isAuthorizedChild ? brandColors.successMain : brandColors.errorMain} />
                  <DetailRow label="Owner:" value={truncateHash(subcontractInfo.owner, 8)} mono />
                  <DetailRow label="Grandfather:" value={truncateHash(subcontractInfo.grandfatherAddress, 8)} mono />
                  <DetailRow label="Total On-Chain Entries:" value={subcontractInfo.totalEntries} />
                </Box>
              </>
            )}
          </AccordionDetails>
        </Accordion>
      )}

      {/* Tampered segment label */}
      {!verified && !partialFile && tampering && (
        <Box
          sx={{
            mb: 3,
            p: 2,
            bgcolor: 'rgba(220, 38, 38, 0.08)',
            border: '1px solid',
            borderColor: brandColors.errorMain,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <AlertTriangle size={20} color={brandColors.errorMain} style={{ flexShrink: 0 }} />
          <Typography variant="body2" sx={{ color: brandColors.offWhite, fontWeight: 600 }}>
            Segment {tampering.divergenceSegmentIndex} has been tampered
          </Typography>
        </Box>
      )}

      {/* Paper Trail timeline (only when tampered) */}
      {!verified && !partialFile && tampering && (
        <Box
          sx={{
            bgcolor: brandColors.surfaceOverlay,
            border: "1px solid",
            borderColor: brandColors.errorMain,
            borderRadius: 2,
            p: 3,
            mb: 3,
          }}
        >
          <SegmentTimeline
            totalSegments={totalSegments}
            divergenceIndex={tampering.divergenceSegmentIndex}
            approximateSecond={tampering.approximateSecond}
          />
        </Box>
      )}

      {/* Tampered: Technical Details Accordion (divergence + hash comparison) */}
      {!verified && !partialFile && tampering && (
        <Accordion disableGutters elevation={0} sx={{ ...technicalAccordionSx, mb: 3 }}>
          <AccordionSummary expandIcon={<ChevronDown size={20} />}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Technical Details
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            {/* Divergence details */}
            <Typography variant="subtitle2" sx={{ mb: 1.5, color: brandColors.offWhite, fontWeight: 600 }}>
              Divergence Point
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 2 }}>
              <DetailRow label="Segment Index:" value={`${tampering.divergenceSegmentIndex} of ${totalSegments - 1}`} />
              <DetailRow label="Byte Offset:" value={formatBytes(tampering.divergenceByteOffset)} />
              {tampering.approximateSecond != null && (
                <DetailRow
                  label="Approximate Time:"
                  value={`~${tampering.approximateSecond}s`}
                  color={brandColors.errorMain}
                />
              )}
            </Box>

            <Divider sx={{ mb: 2, borderColor: brandColors.surfaceBorder }} />

            {/* Side-by-side hash comparison */}
            <Typography variant="subtitle2" sx={{ mb: 1.5, color: brandColors.offWhite, fontWeight: 600 }}>
              Hash Comparison at Segment {tampering.divergenceSegmentIndex}
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              <DetailRow label="Calculated (file):" value={truncateHash(tampering.calculatedHash, 12)} mono color={brandColors.successMain} />
              <DetailRow label="On-chain (original):" value={truncateHash(tampering.onChainHash, 12)} mono color={brandColors.errorMain} />
            </Box>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Tampered: Download untampered portion */}
      {!verified && !partialFile && tampering && (
        <TrimDownload
          videoFile={videoFile}
          divergenceByteOffset={tampering.divergenceByteOffset}
        />
      )}

      {/* Verified: Technical Details Accordion (hash summary + subcontract) */}
      {verified && (
        <Accordion disableGutters elevation={0} sx={{ ...technicalAccordionSx, mb: 3 }}>
          <AccordionSummary expandIcon={<ChevronDown size={20} />}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Technical Details
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            {/* Hash Summary */}
            <Typography variant="subtitle2" sx={{ mb: 1.5, color: brandColors.offWhite, fontWeight: 600 }}>
              <Fingerprint size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Hash Summary
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 2 }}>
              <DetailRow label="Total Segments:" value={totalSegments} />
              <DetailRow label="Blockchain Network:" value="Stability Testnet" />
              <DetailRow label="Calculated Final Hash:" value={truncateHash(calculatedFinalHash, 10)} mono />
              <DetailRow
                label="On-Chain Final Hash:"
                value={truncateHash(onChainFinalHash, 10)}
                mono
                color={brandColors.successMain}
              />
            </Box>

            {/* Subcontract Info */}
            {subcontractInfo && (
              <>
                <Divider sx={{ mb: 2, borderColor: brandColors.surfaceBorder }} />
                <Typography variant="subtitle2" sx={{ mb: 1.5, color: brandColors.offWhite, fontWeight: 600 }}>
                  <Blocks size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                  Subcontract Details
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  <DetailRow label="Authorized Child:" value={subcontractInfo.isAuthorizedChild ? 'Yes' : 'No'} color={subcontractInfo.isAuthorizedChild ? brandColors.successMain : brandColors.errorMain} />
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="body2" sx={{ color: brandColors.gray300, flexShrink: 0, mr: 2 }}>
                      Subcontract Address:
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography
                        variant="caption"
                        sx={{
                          fontFamily: "monospace",
                          textAlign: "right",
                          wordBreak: "break-all",
                          fontWeight: 500,
                          color: brandColors.offWhite,
                        }}
                      >
                        {truncateHash(subcontractInfo.address, 8)}
                      </Typography>
                      {subcontractInfo.address && <CopyButton text={subcontractInfo.address} />}
                    </Box>
                  </Box>
                  <DetailRow label="Owner:" value={truncateHash(subcontractInfo.owner, 8)} mono />
                  <DetailRow label="Grandfather:" value={truncateHash(subcontractInfo.grandfatherAddress, 8)} mono />
                  <DetailRow label="Deployment Block:" value={subcontractInfo.deploymentBlock} />
                  <DetailRow label="Total On-Chain Entries:" value={subcontractInfo.totalEntries} />
                  <DetailRow label="Initialized:" value={subcontractInfo.isInitialized ? 'Yes' : 'No'} />
                  <DetailRow label="Finalized:" value={subcontractInfo.isFinalized ? 'Yes' : 'No'} />
                </Box>
              </>
            )}
          </AccordionDetails>
        </Accordion>
      )}

      <Divider sx={{ mb: 3 }} />

      {/* Actions */}
      <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 2 }}>
        <Button
          variant="outlined"
          onClick={onBack}
          fullWidth
          sx={{ py: 1.5, borderWidth: 2, "&:hover": { borderWidth: 2 } }}
        >
          Back
        </Button>
        {onVerifyAnother && (
          <Button
            variant="outlined"
            onClick={onVerifyAnother}
            fullWidth
            sx={{ py: 1.5, borderWidth: 2, "&:hover": { borderWidth: 2 } }}
          >
            Verify Another Video
          </Button>
        )}
      </Box>
    </ResultShell>
  );
}

/** Shared shell for all result states (verified, tampered, error) */
function ResultShell({ onBack, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
    <Box
      sx={{
        minHeight: "100vh",
        background: brandColors.appBg,
        display: "flex",
        flexDirection: "column",
        p: { xs: 2, md: 4 },
        position: "relative",
      }}
    >
      <Navbar />
      <IconButton
        onClick={onBack}
        sx={{
          position: 'fixed',
          top: { xs: 88, md: 96 },
          left: { xs: 16, md: 24 },
          zIndex: 110,
          color: brandColors.offWhite,
          "&:hover": { bgcolor: brandColors.interactiveOverlayHover },
        }}
      >
        <ArrowLeft size={20} />
      </IconButton>

      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          pt: { xs: 10, md: 11 },
          pb: 4,
        }}
      >
        <Container maxWidth="lg">
          <Card sx={{ boxShadow: 4, background: `linear-gradient(180deg, ${brandColors.cardBgStart} 0%, ${brandColors.cardBgEnd} 100%)` }}>
            <CardContent sx={{ p: { xs: 4, md: 6 } }}>
              {children}
            </CardContent>
          </Card>
        </Container>
      </Box>
    </Box>
    </motion.div>
  );
}
