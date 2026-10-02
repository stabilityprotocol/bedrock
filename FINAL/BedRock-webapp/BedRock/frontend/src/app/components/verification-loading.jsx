import { useEffect, useRef, useState } from 'react';
import { Box, Container, Card, CardContent, Typography, IconButton, LinearProgress } from '@mui/material';
import { ArrowLeft, FileVideo, Hash, Link2, GitCompare, Loader2 } from 'lucide-react';
import { brandColors } from '@/theme';
import { Navbar } from '@/app/components/navbar';
import { networkHeaders } from '@/lib/api';

const PHASES = [
  { label: 'Uploading video...', icon: FileVideo, duration: 1500 },
  { label: 'Hashing video segments...', icon: Hash, duration: 3000 },
  { label: 'Reading blockchain trail...', icon: Link2, duration: 2000 },
  { label: 'Comparing hash chains...', icon: GitCompare, duration: 1000 },
];

export function VerificationLoading({ file, subcontractAddress, videoDurationSeconds, onComplete, onError, onBack }) {
  const [currentPhase, setCurrentPhase] = useState(0);
  const [apiDone, setApiDone] = useState(false);
  const apiResultRef = useRef(null);
  const apiErrorRef = useRef(null);
  const hasStartedRef = useRef(false);

  // Start API call on mount
  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const formData = new FormData();
    formData.append('file', file);
    if (subcontractAddress) {
      formData.append('subcontractAddress', subcontractAddress);
    }
    if (videoDurationSeconds) {
      formData.append('videoDurationSeconds', String(videoDurationSeconds));
    }

    fetch('/api/verify', {
      method: 'POST',
      headers: networkHeaders(),
      body: formData,
    })
      .then(async (res) => {
        let data;
        try {
          data = await res.json();
        } catch {
          throw new Error(
            res.status === 0 || !res.ok
              ? 'Backend is unreachable. Make sure the backend server is running on port 3001.'
              : `Server returned non-JSON response (HTTP ${res.status})`
          );
        }
        if (!res.ok) {
          throw new Error(data.error || 'Verification request failed');
        }
        apiResultRef.current = data;
        setApiDone(true);
      })
      .catch((err) => {
        apiErrorRef.current = err;
        setApiDone(true);
      });
  }, [file, subcontractAddress, videoDurationSeconds]);

  // Animate phases independently of API
  useEffect(() => {
    if (currentPhase >= PHASES.length) return;

    const timer = setTimeout(() => {
      setCurrentPhase((prev) => prev + 1);
    }, PHASES[currentPhase].duration);

    return () => clearTimeout(timer);
  }, [currentPhase]);

  // When both phases are done AND API is done, fire callback
  useEffect(() => {
    if (!apiDone) return;
    if (currentPhase < PHASES.length) return;

    // Small delay so user sees the final phase
    const timer = setTimeout(() => {
      if (apiErrorRef.current) {
        onError(apiErrorRef.current);
      } else {
        onComplete(apiResultRef.current);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [apiDone, currentPhase, onComplete, onError]);

  const progress = Math.min(((currentPhase) / PHASES.length) * 100, 100);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: brandColors.appBg,
        display: 'flex',
        flexDirection: 'column',
        p: { xs: 2, md: 4 },
        position: 'relative',
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
          '&:hover': { bgcolor: brandColors.interactiveOverlayHover },
        }}
      >
        <ArrowLeft size={20} />
      </IconButton>

      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Container maxWidth="sm">
          <Card sx={{ boxShadow: 4, background: `linear-gradient(180deg, ${brandColors.cardBgStart} 0%, ${brandColors.cardBgEnd} 100%)` }}>
            <CardContent sx={{ p: { xs: 4, md: 6 } }}>
              {/* Spinning loader */}
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
                <Box
                  sx={{
                    width: 80, height: 80,
                    borderRadius: '50%',
                    border: '3px solid',
                    borderColor: brandColors.purpleAccent,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: 'pulse 2s ease-in-out infinite',
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                      '50%': { opacity: 0.7, transform: 'scale(0.95)' },
                    },
                  }}
                >
                  <Loader2
                    size={36}
                    color={brandColors.purpleLight}
                    style={{ animation: 'spin 1.5s linear infinite' }}
                  />
                  <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                </Box>
              </Box>

              {/* Title */}
              <Typography variant="h4" align="center" sx={{ mb: 1, color: brandColors.offWhite }}>
                Verifying Video
              </Typography>
              <Typography variant="body2" align="center" sx={{ mb: 4, color: brandColors.gray300 }}>
                {file.name} &bull; {(file.size / (1024 * 1024)).toFixed(1)} MB
              </Typography>

              {/* Progress bar */}
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  mb: 4,
                  height: 6,
                  borderRadius: 3,
                  bgcolor: brandColors.interactiveOverlay,
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 3,
                    background: `linear-gradient(90deg, ${brandColors.gradientViolet}, ${brandColors.pink})`,
                  },
                }}
              />

              {/* Phase steps */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {PHASES.map((phase, i) => {
                  const PhaseIcon = phase.icon;
                  const isDone = i < currentPhase;
                  const isActive = i === currentPhase && currentPhase < PHASES.length;

                  return (
                    <Box
                      key={i}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        opacity: isDone ? 1 : isActive ? 1 : 0.35,
                        transition: 'opacity 0.4s ease',
                      }}
                    >
                      <Box
                        sx={{
                          width: 32, height: 32,
                          borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          bgcolor: isDone ? brandColors.successMain : isActive ? brandColors.purplePrimary : brandColors.interactiveOverlay,
                          transition: 'all 0.4s ease',
                          flexShrink: 0,
                        }}
                      >
                        <PhaseIcon size={16} color={brandColors.white} />
                      </Box>
                      <Typography
                        variant="body2"
                        sx={{
                          color: isDone ? brandColors.successMain : isActive ? brandColors.offWhite : brandColors.gray300,
                          fontWeight: isActive ? 600 : 400,
                          transition: 'all 0.4s ease',
                        }}
                      >
                        {isDone ? phase.label.replace('...', ' ✓') : phase.label}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        </Container>
      </Box>
    </Box>
  );
}
