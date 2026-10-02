import { Component } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { brandColors } from '@/theme';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ minHeight: '100vh', background: brandColors.appBg, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
          <Box sx={{ textAlign: 'center', maxWidth: 480 }}>
            <Typography variant="h4" sx={{ color: brandColors.offWhite, mb: 2 }}>Something went wrong</Typography>
            <Typography variant="body1" sx={{ color: brandColors.subheader, mb: 3 }}>{this.state.error?.message || 'An unexpected error occurred.'}</Typography>
            <Button variant="contained" onClick={() => window.location.reload()}>Reload Page</Button>
          </Box>
        </Box>
      );
    }
    return this.props.children;
  }
}
