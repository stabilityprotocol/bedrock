import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { AlertTriangle } from 'lucide-react';
import { brandColors } from '@/theme';

export function NoTurningBackModal({ isOpen, onProceed, onCancel }) {
  return (
    <Dialog
      open={isOpen}
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          border: `1px solid ${brandColors.warningMain}`,
          bgcolor: brandColors.white,
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AlertTriangle size={24} color={brandColors.warningDark} />
          <Typography variant="h5" sx={{ color: brandColors.purpleDark }}>
            Important Notice Before You Continue
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body1" sx={{ color: brandColors.gray600, mb: 2 }}>
          You are about to begin a secure recording session. Once started, this process cannot be paused,
          cancelled, or reversed. You must complete the recording and allow the App to finish generating and
          anchoring the integrity data to the blockchain before exiting.
        </Typography>

        <Typography variant="body1" sx={{ color: brandColors.gray600, mb: 2 }}>
          Do not close your browser or interrupt the session. After completion, you will be able to download
          your video and Proof-of-Integrity Certificate.
        </Typography>

        <Typography variant="body1" sx={{ color: brandColors.gray600 }}>
          Select "Proceed" only if you are ready to continue without interruption.
        </Typography>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 1.5 }}>
        <Box sx={{ display: 'flex', gap: 1.5, width: '100%', flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
          <Button variant="outlined" onClick={onCancel} fullWidth>
            Go Back
          </Button>
          <Button variant="contained" onClick={onProceed} fullWidth>
            Proceed
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
