import { Box, Container, Card, CardContent, Typography, Button } from '@mui/material';
import { AlertTriangle } from 'lucide-react';
import { brandColors } from '@/theme';

export function LivenessFailedScreen({ onRetry, onBack }) {
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
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Container maxWidth="md">
          <Card sx={{ boxShadow: 4, background: `linear-gradient(180deg, ${brandColors.cardBgStart} 0%, ${brandColors.cardBgEnd} 100%)` }}>
            <CardContent sx={{ p: { xs: 4, md: 6 } }}>
              {/* Failure Icon */}
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                <Box
                  sx={{
                    width: { xs: 80, md: 96 },
                    height: { xs: 80, md: 96 },
                    bgcolor: 'rgba(220, 38, 38, 0.1)',
                    border: `2px solid ${brandColors.errorMain}`,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AlertTriangle size={56} color={brandColors.errorMain} />
                </Box>
              </Box>

              {/* Title */}
              <Typography variant="h3" align="center" sx={{ mb: 2, fontSize: { xs: '2rem', md: '2.5rem' }, color: brandColors.offWhite }}>
                Liveness Check Failed
              </Typography>

              {/* Explanation */}
              <Typography variant="body1" align="center" sx={{ mb: 1.5, color: brandColors.gray300 }}>
                We couldn't confirm a live person in the recording. This can happen due to:
              </Typography>

              <Box
                sx={{
                  bgcolor: brandColors.surfaceOverlay,
                  border: '1px solid',
                  borderColor: brandColors.surfaceBorder,
                  borderRadius: 2,
                  p: 3,
                  mb: 4,
                }}
              >
                <Typography component="ul" variant="body2" sx={{ color: brandColors.gray300, pl: 2, m: 0, '& li': { mb: 0.5 } }}>
                  <li>Face not positioned correctly within the oval</li>
                  <li>Challenge not completed in time</li>
                  <li>Multiple faces detected</li>
                  <li>Poor lighting or dark environment</li>
                  <li>Excessive movement or blur</li>
                </Typography>
              </Box>

              {/* Try Again Button */}
              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={onRetry}
                sx={{ py: 1.5, mb: 1.5, fontSize: '1.125rem' }}
              >
                Try Again
              </Button>

              {/* Back to Home Button */}
              <Button variant="text" fullWidth onClick={onBack} sx={{ py: 1 }}>
                Back to Home
              </Button>
            </CardContent>
          </Card>
        </Container>
      </Box>
    </Box>
  );
}
