import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Box,
  Container,
  Typography,
  Button,
  Alert,
  Divider,
  CircularProgress,
  Snackbar,
  Dialog,
  DialogContent,
  IconButton,
} from '@mui/material';
import { CheckCircle2, Download, AlertTriangle, X, FileText, Hash, Clock } from 'lucide-react';
import { brandColors, fontTokens } from '@/theme';
import { generateCertificate } from '@/lib/certificate';

function formatFilenameDate(epoch) {
  const d = epoch ? new Date(epoch) : new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}_${mm}_${dd}_${hh}${min}`;
}

/** Certificate modal — uses real data from blockchain integration */
function CertificateModal({ open, onClose, timestamp, duration, finalHash, firstTxHash, subcontractAddress, certFilename }) {
  const handleDownload = async () => {
    try {
      await generateCertificate({ subcontractAddress, timestamp, duration, finalHash }, certFilename);
    } catch (e) {
      console.error('[cert download from modal]', e);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: brandColors.cardBgStart,
          border: `1px solid ${brandColors.surfaceBorder}`,
          borderRadius: 3,
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        },
      }}
    >
      <DialogContent sx={{ p: { xs: 3, md: 4 }, position: 'relative' }}>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ position: 'absolute', top: 16, right: 16, color: 'rgba(244,238,255,0.4)', '&:hover': { color: brandColors.offWhite } }}
        >
          <X size={18} />
        </IconButton>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: 'rgba(103,80,164,0.15)', border: `1px solid rgba(103,80,164,0.3)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: brandColors.purpleLight }}>
            <FileText size={20} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: brandColors.offWhite, letterSpacing: '-0.02em' }}>
              Verification Certificate
            </Typography>
            <Typography sx={{ fontSize: '0.8125rem', color: 'rgba(244,238,255,0.45)' }}>Blockchain-anchored evidence</Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
          {[
            { icon: <Clock size={16} />, label: 'Recorded at', value: timestamp },
            { icon: <Clock size={16} />, label: 'Duration', value: `${duration}s` },
            { icon: <Hash size={16} />, label: 'Final hash', value: finalHash || '-', mono: true },
            { icon: <Hash size={16} />, label: 'Transaction ID', value: firstTxHash || '-', mono: true },
          ].map(({ icon, label, value, mono }) => (
            <Box key={label} sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.03)', border: `1px solid ${brandColors.surfaceBorder}` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, color: 'rgba(244,238,255,0.4)' }}>
                {icon}
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'inherit' }}>{label}</Typography>
              </Box>
              <Typography sx={{ fontSize: '0.875rem', color: brandColors.offWhite, fontFamily: mono ? fontTokens.mono : 'inherit', wordBreak: 'break-all' }}>
                {value}
              </Typography>
            </Box>
          ))}
        </Box>

        <Button
          variant="contained"
          startIcon={<Download size={16} />}
          onClick={handleDownload}
          fullWidth
          sx={{
            borderRadius: '100px',
            bgcolor: brandColors.purplePrimary,
            color: brandColors.offWhite,
            textTransform: 'none',
            fontWeight: 500,
            py: 1.375,
            boxShadow: 'none',
            '&:hover': { bgcolor: brandColors.purpleLight, boxShadow: 'none' },
          }}
        >
          Download Certificate
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function SuccessScreen({ timestamp, duration, videoBlob, subcontractAddress, finalHash, recordingStartEpoch, onBack, onCreateAnother }) {
  const [videoDownloadStatus, setVideoDownloadStatus] = useState('pending'); // 'pending' | 'downloaded' | 'failed'
  const [certDownloadStatus, setCertDownloadStatus] = useState('pending');   // 'pending' | 'downloading' | 'downloaded' | 'failed'
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [certOpen, setCertOpen] = useState(false);

  const [chainStatus, setChainStatus] = useState('pending'); // 'pending' | 'complete' | 'error'
  const pollRef = useRef(null);

  useEffect(() => {
    if (!subcontractAddress) return;

    async function checkStatus() {
      try {
        const res = await fetch(`/api/subcontract/${subcontractAddress}/status`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === 'complete') {
          setChainStatus('complete');
          clearInterval(pollRef.current);
        } else if (data.status === 'error') {
          setChainStatus('error');
          clearInterval(pollRef.current);
        }
      } catch {
        // Network error — keep polling
      }
    }

    checkStatus();
    pollRef.current = setInterval(checkStatus, 3000);
    return () => clearInterval(pollRef.current);
  }, [subcontractAddress]);

  const chainReady = chainStatus === 'complete';

  const dateSuffix = formatFilenameDate(recordingStartEpoch);
  const videoExt = videoBlob?.type?.includes('mp4') ? 'mp4' : 'webm';
  const videoFilename = `bedrock_evidence_${dateSuffix}.${videoExt}`;
  const certFilename = `poic_${dateSuffix}.pdf`;

  function handleDownloadVideo() {
    try {
      if (!videoBlob) throw new Error('No recording available');
      const url = URL.createObjectURL(videoBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = videoFilename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setVideoDownloadStatus('downloaded');
      setSnackbarMessage('Video downloaded');
      setShowSnackbar(true);
    } catch (e) {
      console.error('[video download]', e);
      setVideoDownloadStatus('failed');
    }
  }

  async function handleDownloadCertificate() {
    setCertDownloadStatus('downloading');
    try {
      await generateCertificate({ subcontractAddress, timestamp, duration, finalHash }, certFilename);
      setCertDownloadStatus('downloaded');
      setSnackbarMessage('Certificate downloaded');
      setShowSnackbar(true);
    } catch (e) {
      console.error('[cert download]', e);
      setCertDownloadStatus('failed');
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
    <Box
      sx={{
        minHeight: '100vh',
        background: `radial-gradient(ellipse 60% 40% at 50% 0%, ${brandColors.purpleDark} 0%, transparent 60%), ${brandColors.appBg}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 2, md: 4 },
      }}
    >
      <Container maxWidth="sm">
        <Box
          sx={{
            background: `linear-gradient(180deg, ${brandColors.cardBgStart} 0%, ${brandColors.cardBgEnd} 100%)`,
            border: `1px solid ${brandColors.surfaceBorder}`,
            borderRadius: 3,
            p: { xs: 4, md: 5 },
            boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(232,222,248,0.06)',
          }}
        >
          {/* Success Icon */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            <Box
              role="img"
              aria-label="Recording successful"
              sx={{
                width: { xs: 80, md: 88 },
                height: { xs: 80, md: 88 },
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(16, 185, 129, 0.12)',
                border: `1.5px solid ${brandColors.successMain}`,
                boxShadow: `0 0 32px rgba(16, 185, 129, 0.3), 0 0 0 8px rgba(16, 185, 129, 0.08)`,
              }}
            >
              <CheckCircle2 size={44} color={brandColors.successMain} strokeWidth={1.5} />
            </Box>
          </Box>

          {/* Title */}
          <Typography
            variant="h3"
            align="center"
            sx={{
              mb: 0.75,
              fontSize: { xs: '1.75rem', md: '2rem' },
              color: brandColors.offWhite,
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            Evidence Created
          </Typography>
          <Typography
            align="center"
            sx={{ color: brandColors.gray300, fontSize: '0.875rem', mb: 3.5 }}
          >
            Your recording has been hashed and anchored to the blockchain.
          </Typography>

          {/* Timestamp */}
          <Box
            sx={{
              bgcolor: brandColors.surfaceOverlay,
              border: '1px solid',
              borderColor: brandColors.surfaceBorder,
              borderRadius: 2,
              p: 2.5,
              mb: 3,
              textAlign: 'center',
            }}
          >
            <Typography
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 500,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: brandColors.gray300,
                mb: 0.75,
              }}
            >
              Recorded at
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: '1.125rem', md: '1.25rem' },
                fontWeight: 600,
                color: brandColors.offWhite,
                fontFamily: fontTokens.mono,
                letterSpacing: '0.04em',
              }}
            >
              {timestamp}
            </Typography>
            <Typography sx={{ mt: 0.75, color: brandColors.gray300, fontSize: '0.8125rem' }}>
              Duration: {duration}s
            </Typography>
          </Box>

          {/* On-Chain Status */}
          <Box
            sx={{
              mb: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 2,
              borderRadius: 2,
              bgcolor: chainReady ? 'rgba(16, 185, 129, 0.08)' : 'rgba(103, 80, 164, 0.08)',
              border: `1px solid ${chainReady ? 'rgba(16, 185, 129, 0.25)' : 'rgba(103, 80, 164, 0.2)'}`,
            }}
          >
            {chainReady ? (
              <CheckCircle2 size={18} color={brandColors.successMain} />
            ) : chainStatus === 'error' ? (
              <AlertTriangle size={18} color={brandColors.errorMain} />
            ) : (
              <CircularProgress size={16} sx={{ color: brandColors.purpleLight }} />
            )}
            <Typography variant="body2" sx={{ color: chainReady ? brandColors.successMain : chainStatus === 'error' ? brandColors.errorMain : brandColors.gray300 }}>
              {chainReady
                ? 'All hashes have been anchored to the blockchain. Your files are ready to download.'
                : chainStatus === 'error'
                  ? 'An error occurred while writing hashes to the blockchain. Please contact support.'
                  : 'Writing hashes to the blockchain\u2026 Please wait before downloading.'}
            </Typography>
          </Box>

          {/* Critical Warning */}
          <Alert
            severity="warning"
            icon={<AlertTriangle size={18} />}
            sx={{
              mb: 3,
              bgcolor: 'rgba(245, 158, 11, 0.08)',
              border: `1px solid rgba(245, 158, 11, 0.3)`,
              borderRadius: 2,
              '& .MuiAlert-icon': { color: brandColors.warningMain },
              '& .MuiAlert-message': { width: '100%' },
            }}
          >
            <Typography sx={{ fontWeight: 600, fontSize: '0.8125rem', mb: 0.5, color: brandColors.warningMain }}>
              Important
            </Typography>
            <Typography variant="body2" sx={{ color: brandColors.offWhite, opacity: 0.85 }}>
              Please save your Certificate and Video immediately. They cannot be retrieved once you exit
              this screen.
            </Typography>
          </Alert>

          {/* Download status alerts */}
          {videoDownloadStatus === 'failed' && (
            <Alert severity="error" sx={{ mb: 1.5, borderRadius: 2 }}>
              Video download failed. Please try again.
            </Alert>
          )}
          {certDownloadStatus === 'failed' && (
            <Alert severity="error" sx={{ mb: 1.5, borderRadius: 2 }}>
              Certificate download failed. Please try again.
            </Alert>
          )}

          <Divider sx={{ borderColor: brandColors.surfaceBorder, mb: 3 }} />

          {/* Actions */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {/* Download Video */}
            <Button
              variant="contained"
              size="large"
              startIcon={!chainReady ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : <Download size={16} />}
              fullWidth
              onClick={handleDownloadVideo}
              disabled={!chainReady}
              sx={{
                py: 1.5,
                textTransform: 'none',
                fontWeight: 500,
                bgcolor: brandColors.purplePrimary,
                boxShadow: `0 4px 16px rgba(103, 80, 164, 0.4)`,
                '&:hover': { bgcolor: brandColors.purpleLight },
                '&:disabled': { opacity: 0.68, boxShadow: 'none' },
              }}
            >
              {!chainReady
                ? 'Waiting for blockchain\u2026'
                : videoDownloadStatus === 'downloaded'
                  ? 'Re-download Video'
                  : 'Download Video'}
            </Button>

            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 1.5 }}>
              {/* Download Certificate */}
              <Button
                variant="outlined"
                startIcon={certDownloadStatus === 'downloading' ? <CircularProgress size={16} color="inherit" /> : <Download size={16} />}
                fullWidth
                onClick={handleDownloadCertificate}
                disabled={!chainReady || certDownloadStatus === 'downloading'}
                sx={{
                  py: 1.375,
                  textTransform: 'none',
                  fontWeight: 500,
                  borderColor: brandColors.surfaceBorder,
                  color: brandColors.offWhite,
                  '&:hover': { borderColor: brandColors.purpleLight, bgcolor: brandColors.interactiveOverlay },
                  '&:disabled': { opacity: 0.68 },
                }}
              >
                {certDownloadStatus === 'downloading'
                  ? 'Generating...'
                  : certDownloadStatus === 'downloaded'
                    ? 'Re-download Certificate'
                    : 'Download Certificate'}
              </Button>

              {/* View Certificate modal */}
              <Button
                variant="outlined"
                fullWidth
                disabled={!chainReady}
                onClick={() => setCertOpen(true)}
                sx={{
                  py: 1.375,
                  textTransform: 'none',
                  fontWeight: 500,
                  borderColor: brandColors.surfaceBorder,
                  color: brandColors.offWhite,
                  '&:hover': { borderColor: brandColors.purpleLight, bgcolor: brandColors.interactiveOverlay },
                  '&:disabled': { opacity: 0.68 },
                }}
              >
                View Certificate
              </Button>
            </Box>

            {/* Create Another / Back */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 1.5 }}>
              {onCreateAnother && (
                <Button
                  variant="outlined"
                  onClick={onCreateAnother}
                  fullWidth
                  sx={{
                    py: 1.25,
                    textTransform: 'none',
                    fontWeight: 500,
                    borderColor: brandColors.surfaceBorder,
                    color: brandColors.offWhite,
                    '&:hover': { borderColor: brandColors.purpleLight, bgcolor: brandColors.interactiveOverlay },
                    '&:disabled': { opacity: 0.68 },
                  }}
                >
                  Create Another Video
                </Button>
              )}
              <Button
                onClick={onBack}
                fullWidth
                sx={{
                  py: 1.25,
                  textTransform: 'none',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  color: 'rgba(244,238,255,0.45)',
                  '&:hover': { bgcolor: brandColors.interactiveOverlay, color: brandColors.offWhite },
                  '&:disabled': { opacity: 0.38 },
                }}
              >
                Back to Home
              </Button>
            </Box>
          </Box>
        </Box>
      </Container>

      <CertificateModal
        open={certOpen}
        onClose={() => setCertOpen(false)}
        timestamp={timestamp}
        duration={duration}
        finalHash={finalHash}
        firstTxHash={null}
        subcontractAddress={subcontractAddress}
        certFilename={certFilename}
      />

      <Snackbar
        open={showSnackbar}
        autoHideDuration={4000}
        onClose={() => setShowSnackbar(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message={snackbarMessage}
      />
    </Box>
    </motion.div>
  );
}
