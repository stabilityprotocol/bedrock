import { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Box, Container, Typography, Button, IconButton } from '@mui/material';
import { Upload, ArrowLeft, FileVideo } from 'lucide-react';
import { brandColors, fontTokens } from '@/theme';
import { Navbar } from '@/app/components/navbar';

function GradientUploadIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="uploadCircleGradient" x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={brandColors.gradientOrange} />
          <stop offset="0.35" stopColor={brandColors.pink} />
          <stop offset="0.79" stopColor={brandColors.gradientViolet} />
          <stop offset="1" stopColor={brandColors.gradientBlue} />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="28" stroke="url(#uploadCircleGradient)" strokeWidth="2.5" fill="none" />
      <path
        d="M32 20V41M32 20L23.5 28.5M32 20L40.5 28.5M22 44H42"
        stroke="url(#uploadCircleGradient)"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Extract video duration in seconds from a File object.
 * Creates a temporary video element to read metadata.
 * @param {File} file
 * @returns {Promise<number>} duration in seconds
 */
function getVideoDuration(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';

    const finish = () => {
      URL.revokeObjectURL(video.src);
      if (video.duration && isFinite(video.duration)) {
        resolve(Math.round(video.duration));
      } else {
        resolve(0);
      }
    };

    video.onloadedmetadata = () => {
      if (video.duration && isFinite(video.duration)) {
        finish();
        return;
      }
      // WebM from MediaRecorder often reports Infinity duration.
      // Seeking to the end forces the browser to discover the real length.
      video.currentTime = Number.MAX_SAFE_INTEGER;
    };

    video.ontimeupdate = function onceSeek() {
      video.ontimeupdate = null;
      finish();
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      resolve(0);
    };

    video.src = URL.createObjectURL(file);
  });
}

export function UploadScreen({ onVerify, onBack }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) setSelectedFile(droppedFile);
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleNativeFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleVerify = async () => {
    if (!selectedFile) return;
    setIsExtracting(true);

    try {
      const duration = await getVideoDuration(selectedFile);
      // Backend auto-resolves subcontract address from the video's first hash
      onVerify(selectedFile, null, duration);
    } catch (err) {
      console.error('[upload] Error reading video metadata:', err);
      onVerify(selectedFile, null, 0);
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
    <Box
      sx={{
        minHeight: '100vh',
        background:
          'radial-gradient(ellipse 60% 40% at 50% 0%, #1A1040 0%, transparent 60%), radial-gradient(circle at 50% 50%, #0C082B 0%, #000000 100%)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <Navbar />

      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept="video/mp4,video/quicktime,video/x-msvideo,video/webm"
        onChange={handleNativeFileSelect}
      />

      {/* Main Content */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pt: { xs: 10, md: 10 },
          pb: 6,
          px: { xs: 2, md: 4 },
        }}
      >
        <Container maxWidth="md" sx={{ width: '100%' }}>
          {/* Back Button */}
          <IconButton
            onClick={onBack}
            sx={{
              position: 'fixed',
              top: { xs: 88, md: 96 },
              left: { xs: 16, md: 24 },
              zIndex: 110,
              color: brandColors.offWhite,
              '&:hover': { bgcolor: brandColors.interactiveOverlayHover },
            }}
          >
            <ArrowLeft size={20} />
          </IconButton>

          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography
              sx={{
                fontSize: '0.6875rem',
                fontWeight: 500,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: brandColors.gray300,
                mb: 1,
              }}
            >
              Verification
            </Typography>
            <Typography
              variant="h3"
              sx={{
                mb: 1,
                fontSize: { xs: '1.75rem', md: '2.25rem' },
                color: brandColors.offWhite,
                fontWeight: 700,
                letterSpacing: '-0.02em',
              }}
            >
              Verify Video Evidence
            </Typography>
            <Typography sx={{ color: brandColors.gray300, fontSize: '0.9375rem' }}>
              Upload a video file to verify its authenticity on the blockchain
            </Typography>
          </Box>

          {/* Card */}
          <Box
            sx={{
              background: `linear-gradient(180deg, ${brandColors.cardBgStart} 0%, ${brandColors.cardBgEnd} 100%)`,
              border: `1px solid ${brandColors.surfaceBorder}`,
              borderRadius: 3,
              p: { xs: 3, md: 4 },
              boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
            }}
          >
            {/* Upload Zone */}
            <Box
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={selectedFile ? undefined : handleFileSelect}
              sx={{
                border: '2px dashed',
                borderColor: isDragging
                  ? brandColors.pink
                  : selectedFile
                  ? brandColors.successMain
                  : brandColors.surfaceBorder,
                bgcolor: isDragging
                  ? 'rgba(255, 0, 200, 0.06)'
                  : selectedFile
                  ? 'rgba(16, 185, 129, 0.06)'
                  : 'rgba(255,255,255,0.02)',
                borderRadius: 2,
                p: { xs: 5, md: 7 },
                textAlign: 'center',
                cursor: selectedFile ? 'default' : 'pointer',
                boxShadow: isDragging ? `0 0 0 4px rgba(255, 0, 200, 0.12)` : 'none',
                '&:hover': selectedFile
                  ? {}
                  : {
                      borderColor: brandColors.purpleLight,
                      bgcolor: brandColors.interactiveOverlay,
                    },
              }}
            >
              {selectedFile ? (
                <Box>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      mx: 'auto',
                      mb: 2,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'rgba(16, 185, 129, 0.12)',
                      border: `1.5px solid ${brandColors.successMain}`,
                      boxShadow: `0 0 20px rgba(16, 185, 129, 0.25)`,
                    }}
                  >
                    <FileVideo size={26} color={brandColors.successMain} />
                  </Box>
                  <Typography
                    variant="h6"
                    sx={{ mb: 0.5, color: brandColors.offWhite, fontSize: '1rem', fontWeight: 600 }}
                  >
                    {selectedFile.name}
                  </Typography>
                  <Typography variant="body2" sx={{ color: brandColors.gray300, mb: 2.5 }}>
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · Ready to verify
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setSelectedFile(null)}
                    sx={{
                      textTransform: 'none',
                      color: brandColors.offWhite,
                      borderColor: brandColors.surfaceBorder,
                      '&:hover': { borderColor: brandColors.pink, bgcolor: 'rgba(255, 0, 200, 0.08)' },
                    }}
                  >
                    Choose Different File
                  </Button>
                </Box>
              ) : (
                <Box>
                  <Box sx={{ mx: 'auto', mb: 2.5, display: 'flex', justifyContent: 'center' }}>
                    <GradientUploadIcon />
                  </Box>
                  <Typography variant="h6" sx={{ mb: 1, color: brandColors.offWhite, fontSize: '1rem', fontWeight: 600 }}>
                    Drag and drop your video file here
                  </Typography>
                  <Typography sx={{ color: brandColors.gray300, mb: 2.5, fontSize: '0.875rem' }}>
                    or
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<Upload size={16} />}
                    sx={{
                      mb: 2,
                      textTransform: 'none',
                      fontWeight: 500,
                      bgcolor: brandColors.purplePrimary,
                      boxShadow: `0 4px 16px rgba(103, 80, 164, 0.35)`,
                      '&:hover': { bgcolor: brandColors.purpleLight },
                    }}
                  >
                    Select File
                  </Button>
                  <Typography variant="body2" sx={{ color: brandColors.gray300 }}>
                    Supports: MP4, MOV, AVI, WebM · Max 2 GB
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Info */}
            <Box
              sx={{
                mt: 3,
                bgcolor: brandColors.infoOverlay,
                border: `1px solid ${brandColors.surfaceBorder}`,
                borderRadius: 2,
                p: 2,
              }}
            >
              <Typography variant="body2" sx={{ color: brandColors.offWhite, lineHeight: 1.7 }}>
                <Box component="span" sx={{ fontWeight: 600 }}>How it works: </Box>
                We'll re-hash every byte of your video using the same algorithm used during recording,
                then compare the result against the blockchain record. If every segment matches, the video is authentic and unmodified.
              </Typography>
            </Box>

            {/* Verify Button */}
            <Button
              variant="contained"
              size="large"
              onClick={handleVerify}
              disabled={!selectedFile || isExtracting}
              fullWidth
              sx={{
                mt: 3,
                py: 1.75,
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '1rem',
                bgcolor: brandColors.purplePrimary,
                boxShadow: `0 4px 20px rgba(103, 80, 164, 0.4)`,
                '&:hover': { bgcolor: brandColors.purpleLight, boxShadow: `0 6px 24px rgba(139, 120, 193, 0.45)` },
                '&:disabled': { opacity: 0.4, boxShadow: 'none' },
              }}
            >
              {isExtracting ? 'Reading video metadata...' : 'Verify Video'}
            </Button>
          </Box>
        </Container>
      </Box>
    </Box>
    </motion.div>
  );
}
