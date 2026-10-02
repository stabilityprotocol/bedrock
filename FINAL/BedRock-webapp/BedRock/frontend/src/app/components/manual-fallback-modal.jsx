import { useState } from 'react';
import { Box, Container, Card, CardContent, Typography, Button, TextField, IconButton, Alert } from '@mui/material';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { brandColors } from '@/theme';
import { Navbar } from '@/app/components/navbar';

export function ManualFallbackModal({ onVerify, onBack }) {
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');

  const handleVerify = () => {
    if (!address.trim()) {
      setError('Please enter a smart contract address');
      return;
    }
    if (!address.startsWith('0x') || address.length < 42) {
      setError('Please enter a valid smart contract address');
      return;
    }
    setError('');
    onVerify(address);
  };

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
      {/* Navbar */}
      <Navbar />

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

      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Container maxWidth="md">
          <Card sx={{ boxShadow: 4, background: `linear-gradient(180deg, ${brandColors.cardBgStart} 0%, ${brandColors.cardBgEnd} 100%)` }}>
            <CardContent sx={{ p: { xs: 4, md: 6 } }}>
              {/* Warning Icon */}
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    bgcolor: brandColors.purpleAccent,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AlertCircle size={48} color={brandColors.purpleLight} />
                </Box>
              </Box>

              {/* Title */}
              <Typography variant="h4" align="center" sx={{ mb: 1.5, fontSize: { xs: '1.75rem', md: '2rem' }, color: brandColors.offWhite }}>
                Metadata Not Found
              </Typography>
              <Typography variant="body1" align="center" sx={{ mb: 4, color: brandColors.gray300 }}>
                Smart Contract Address not found in video metadata
              </Typography>

              {/* Info Box */}
              <Alert
                severity="warning"
                sx={{
                  mb: 3,
                  bgcolor: brandColors.infoOverlay,
                  border: `1px solid ${brandColors.gray300}`,
                  '& .MuiAlert-icon': {
                    color: brandColors.purpleLight,
                  },
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: brandColors.offWhite }}>
                  What does this mean?
                </Typography>
                <Typography variant="body2" sx={{ color: brandColors.offWhite }}>
                  The video file doesn't contain embedded blockchain metadata. This could happen if the video was
                  re-encoded, edited, or wasn't created with our platform. You can still verify it by manually entering
                  the smart contract address.
                </Typography>
              </Alert>

              {/* Input Field */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: brandColors.offWhite }}>
                  Smart Contract Address
                </Typography>
                <TextField
                  fullWidth
                  placeholder="0x..."
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setError('');
                  }}
                  error={!!error}
                  helperText={error}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      height: 48,
                      color: brandColors.offWhite,
                      bgcolor: brandColors.interactiveOverlay,
                      '& fieldset': {
                        borderColor: brandColors.gray300,
                      },
                      '&:hover fieldset': {
                        borderColor: brandColors.purpleLight,
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: brandColors.pink,
                      },
                    },
                    '& .MuiFormHelperText-root': {
                      color: brandColors.errorLight,
                    },
                  }}
                />
                <Typography variant="caption" sx={{ mt: 1, display: 'block', color: brandColors.gray300 }}>
                  The smart contract address should have been provided when the video was originally created. It's a
                  42-character hexadecimal string starting with "0x".
                </Typography>
              </Box>

              {/* Actions */}
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column-reverse', md: 'row' }, gap: 2 }}>
                <Button
                  variant="outlined"
                  onClick={onBack}
                  fullWidth
                  sx={{ py: 1.5, borderWidth: 2, '&:hover': { borderWidth: 2 } }}
                >
                  Cancel
                </Button>
                <Button variant="contained" onClick={handleVerify} fullWidth sx={{ py: 1.5 }}>
                  Verify Address
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Container>
      </Box>
    </Box>
  );
}
