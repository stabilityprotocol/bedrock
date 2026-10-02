import { createTheme } from '@mui/material/styles';

// ─── Font Tokens ─────────────────────────────────────────────────────────────
export const fontTokens = {
  display: "'Source Serif 4', Georgia, 'Times New Roman', serif",
  ui:      "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  body:    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono:    "'IBM Plex Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
};

// Semantic role aliases
export const typeRoles = {
  hero:           fontTokens.display,
  sectionHeading: fontTokens.ui,
  body:           fontTokens.body,
  metadata:       fontTokens.mono,
};

// Brand Colors
export const brandColors = {
  // Wireframe / Material 3 inspired purple palette
  purplePrimary: '#6750A4',    // Primary action color
  purpleLight: '#8B78C1',      // Hover states and borders
  purpleDark: '#27174E',       // Strong contrast purple
  purplePale: '#F6F2FD',       // Light surface tint
  purpleAccent: '#E8DEF8',     // Elevated surface accent
  purpleText: '#4A3C78',       // Readable purple text on light accent

  // Core app surfaces from wireframes
  appBg: '#0C0A17',            // Main dark canvas
  navBg: 'rgba(19, 16, 29, 0.7)',
  cardBgStart: '#13102F',
  cardBgEnd: '#302355',
  pink: '#C026A0',
  gold: '#F4A554',
  gradientOrange: '#FF9D00',
  gradientViolet: '#7142FF',
  gradientBlue: '#4043F1',

  // Neutral Palette
  gray900: '#1e293b',          // Dark gray - Primary text on light cards
  gray600: '#64748b',          // Medium gray - Secondary text
  gray400: '#94a3b8',          // Light gray - Disabled text
  gray300: '#8982AA',          // Wireframe border/supporting purple-gray
  subheader: '#8982AA',        // Figma subheader variable (alias of gray300)
  gray100: '#f1f5f9',          // Very light gray - Subtle backgrounds

  // Semantic Colors
  successMain: '#10b981',      // Emerald green - Success states
  successLight: '#34d399',     // Light green - Success backgrounds
  successDark: '#059669',      // Dark green - Success active

  errorMain: '#dc2626',        // Red - Error states
  errorLight: '#ef4444',       // Light red - Error backgrounds
  errorDark: '#b91c1c',        // Dark red - Error active

  warningMain: '#f59e0b',      // Amber - Warning states
  warningLight: '#fbbf24',     // Light amber - Warning backgrounds
  warningDark: '#d97706',      // Dark amber - Warning active
  warningSurface: '#FEF3C7',   // Warning alert background surface

  successSurface: '#ECFDF5',   // Success alert background surface
  errorSurface: '#FEF2F2',     // Error alert background surface

  // Special
  white: '#ffffff',            // Pure white - High contrast elements
  offWhite: '#F4EEFF',         // Wireframe on-dark text color

  // Shared dark-surface utility tokens
  surfaceOverlay: 'rgba(19, 16, 47, 0.85)',
  surfaceBorder: 'rgba(232, 222, 248, 0.3)',
  interactiveOverlay: 'rgba(255, 255, 255, 0.04)',
  interactiveOverlayHover: 'rgba(255, 255, 255, 0.10)',
  infoOverlay: 'rgba(232, 222, 248, 0.2)',
};

export const theme = createTheme({
  palette: {
    primary: {
      main: brandColors.purplePrimary,
      light: brandColors.purpleLight,
      dark: brandColors.purpleDark,
      contrastText: brandColors.white,
    },
    secondary: {
      main: brandColors.gray600,
      light: brandColors.gray400,
      dark: brandColors.gray900,
      contrastText: brandColors.white,
    },
    success: {
      main: brandColors.successMain,
      light: brandColors.successLight,
      dark: brandColors.successDark,
      contrastText: brandColors.white,
    },
    error: {
      main: brandColors.errorMain,
      light: brandColors.errorLight,
      dark: brandColors.errorDark,
      contrastText: brandColors.white,
    },
    warning: {
      main: brandColors.warningMain,
      light: brandColors.warningLight,
      dark: brandColors.warningDark,
      contrastText: brandColors.white,
    },
    background: {
      default: brandColors.appBg,
      paper: brandColors.white,
    },
    text: {
      primary: brandColors.gray900,
      secondary: brandColors.gray600,
    },
  },
  typography: {
    // Default: Inter for readability
    fontFamily: fontTokens.body,
    // h1: Source Serif 4 — authority, hero display
    h1: {
      fontFamily: fontTokens.display,
      fontWeight: 700,
      fontSize: 'clamp(2.5rem, 4.5vw, 4rem)',
      lineHeight: 1.02,
      letterSpacing: '-0.025em',
    },
    // h2–h6: IBM Plex Sans — product structure
    h2: {
      fontFamily: fontTokens.ui,
      fontWeight: 600,
      fontSize: '2rem',
      lineHeight: 1.12,
      letterSpacing: '-0.02em',
    },
    h3: {
      fontFamily: fontTokens.ui,
      fontWeight: 600,
      fontSize: '1.5rem',
      lineHeight: 1.18,
      letterSpacing: '-0.015em',
    },
    h4: {
      fontFamily: fontTokens.ui,
      fontWeight: 600,
      fontSize: '1.25rem',
      lineHeight: 1.24,
      letterSpacing: '-0.01em',
    },
    h5: {
      fontFamily: fontTokens.ui,
      fontWeight: 600,
      fontSize: '1.125rem',
      lineHeight: 1.3,
      letterSpacing: '-0.005em',
    },
    h6: {
      fontFamily: fontTokens.ui,
      fontWeight: 600,
      fontSize: '1rem',
      lineHeight: 1.35,
      letterSpacing: '0',
    },
    // subtitle: IBM Plex Sans — UI labelling
    subtitle1: {
      fontFamily: fontTokens.ui,
      fontWeight: 500,
      fontSize: '1rem',
      lineHeight: 1.4,
    },
    subtitle2: {
      fontFamily: fontTokens.ui,
      fontWeight: 500,
      fontSize: '0.875rem',
      lineHeight: 1.4,
    },
    // body: Inter — sustained reading
    body1: {
      fontFamily: fontTokens.body,
      fontSize: '1rem',
      lineHeight: 1.6,
      letterSpacing: '-0.005em',
    },
    body2: {
      fontFamily: fontTokens.body,
      fontSize: '0.9375rem',
      lineHeight: 1.55,
      letterSpacing: '-0.003em',
    },
    caption: {
      fontFamily: fontTokens.body,
      fontSize: '0.8125rem',
      lineHeight: 1.45,
    },
    // button: IBM Plex Sans — precise, product-facing
    button: {
      fontFamily: fontTokens.ui,
      textTransform: 'none',
      fontWeight: 500,
      fontSize: '0.9375rem',
      letterSpacing: '-0.005em',
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 100,
          padding: '10px 20px',
          fontSize: '0.9375rem',
          boxShadow: 'none',
        },
        sizeLarge: {
          padding: '12px 24px',
          fontSize: '0.9375rem',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundColor: brandColors.white,
          boxShadow: '0 4px 6px -1px rgba(51, 36, 161, 0.1), 0 2px 4px -1px rgba(51, 36, 161, 0.06)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#13102F',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: '#13102F',
          border: '1px solid rgba(232, 222, 248, 0.12)',
        },
        list: {
          padding: '4px',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          color: '#F4EEFF',
          fontSize: '0.9375rem',
          borderRadius: '6px',
          '&:hover': {
            backgroundColor: 'rgba(103, 80, 164, 0.15)',
          },
          '&.Mui-selected': {
            backgroundColor: 'rgba(103, 80, 164, 0.25)',
            '&:hover': {
              backgroundColor: 'rgba(103, 80, 164, 0.3)',
            },
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        icon: {
          color: 'rgba(244, 238, 255, 0.4)',
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          backgroundColor: '#13102F',
          border: '1px solid rgba(232, 222, 248, 0.12)',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
          },
          '& .MuiInputLabel-root.Mui-disabled': {
            color: 'rgba(244, 238, 255, 0.3)',
          },
          '& .MuiOutlinedInput-root.Mui-disabled': {
            color: 'rgba(244, 238, 255, 0.35)',
            WebkitTextFillColor: 'rgba(244, 238, 255, 0.35)',
          },
        },
      },
    },
  },
});
