import { useState, useEffect } from 'react';
import { Box, Container, Typography, Button, Drawer, IconButton, Divider } from '@mui/material';
import { Logo } from '@/app/components/logo';
import { ArrowRight, Menu, X, BookOpen, HelpCircle, Mail, FileText, Layers, Shield } from 'lucide-react';
import { brandColors, fontTokens } from '@/theme';
import { getNetwork, setNetwork } from '@/lib/api';

const navItems = [
  { label: 'Instructions', screen: 'instructions', icon: BookOpen },
  { label: 'FAQ', screen: 'faq', icon: HelpCircle },
  { label: 'Documentation', screen: 'documentation', icon: FileText },
  { label: 'Platforms', screen: 'platforms', icon: Layers },
  { label: 'Privacy', screen: 'privacy', icon: Shield },
  { label: 'Contact', screen: 'contact', icon: Mail },
];

export function Navbar({
  onLogoClick,
  onDemoClick,
  onNavClick,
  currentScreen,
  disabled = false,
  inApp = false,  // true when user is inside the app (not on landing)
  // Backward-compat props used by kept aws-liveness components
  variant,
  activeItem,
  onNavItemSelect,
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [network, setNetworkState] = useState(getNetwork());

  useEffect(() => {
    const handler = (ev) => setNetworkState(ev.detail);
    window.addEventListener('bedrock-network-change', handler);
    return () => window.removeEventListener('bedrock-network-change', handler);
  }, []);

  const toggleNetwork = () => {
    setNetwork(network === 'testnet' ? 'mainnet' : 'testnet');
  };

  // Alias resolution: merge old prop interface into new
  const effectiveScreen = currentScreen || activeItem;
  const effectiveNavClick = onNavClick || onNavItemSelect;
  const isLight = variant === 'light';

  const navTextColor = isLight ? 'rgba(30, 30, 50, 0.7)' : 'rgba(244, 238, 255, 0.7)';

  const handleNavItem = (screen) => {
    if (effectiveNavClick) {
      effectiveNavClick(screen);
    } else {
      window.location.hash = '#/';
      window.dispatchEvent(new CustomEvent('bedrock-nav', { detail: { screen } }));
    }
    setDrawerOpen(false);
  };

  const handleLogoFallback = () => {
    if (onLogoClick) {
      onLogoClick();
    } else {
      window.location.hash = '#/';
    }
  };

  const handleDemoFallback = () => {
    if (onDemoClick) {
      onDemoClick();
    } else {
      window.location.hash = '#/app';
    }
  };

  return (
    <>
      <Box
        component="nav"
        aria-label="Main navigation"
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          height: 72,
          px: { xs: 2, md: '80px' },
          display: 'flex',
          alignItems: 'center',
          bgcolor: isLight ? 'rgba(255, 255, 255, 0.92)' : 'rgba(12, 10, 23, 0.75)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : brandColors.surfaceBorder}`,
        }}
      >
        <Container maxWidth={false} disableGutters>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
            }}
          >
            {/* Left: Logo */}
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                cursor: !disabled ? 'pointer' : 'default',
                pointerEvents: disabled ? 'none' : 'auto',
                opacity: disabled ? 0.5 : 1,
              }}
              onClick={disabled ? undefined : handleLogoFallback}
            >
              <Logo variant="horizontal" size="small" color={isLight ? brandColors.deepPurple || '#1a1a2e' : brandColors.offWhite} />
            </Box>

            {/* Center: Navigation Items (desktop only) */}
            <Box
              sx={{
                display: { xs: 'none', md: 'flex' },
                alignItems: 'center',
                gap: 1,
                flexShrink: 0,
              }}
            >
              {navItems.map((item) => {
                const isActive = effectiveScreen === item.screen;
                const Icon = item.icon;
                const itemColor = isActive ? brandColors.gold : navTextColor;
                return (
                  <Box
                    key={item.label}
                    onClick={() => handleNavItem(item.screen)}
                    aria-current={isActive ? 'page' : undefined}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.75,
                      px: 1.5,
                      py: 0.875,
                      borderRadius: '20px',
                      cursor: disabled ? 'default' : 'pointer',
                      pointerEvents: disabled ? 'none' : 'auto',
                      bgcolor: isActive ? 'rgba(244,165,84,0.08)' : 'transparent',
                      border: '1px solid',
                      borderColor: isActive ? 'rgba(244,165,84,0.3)' : 'transparent',
                      transition: 'background-color 0.18s, border-color 0.18s',
                      '&:hover': {
                        bgcolor: 'rgba(244,165,84,0.06)',
                        borderColor: 'rgba(244,165,84,0.15)',
                      },
                    }}
                  >
                    <Icon size={14} color={itemColor} fill={isActive ? itemColor : 'none'} style={{ flexShrink: 0, transition: 'color 0.18s' }} />
                    <Typography
                      sx={{
                        fontSize: '0.875rem',
                        fontWeight: isActive ? 500 : 400,
                        color: itemColor,
                        transition: 'color 0.18s',
                        fontFamily: fontTokens.ui,
                        lineHeight: 1,
                      }}
                    >
                      {item.label}
                    </Typography>
                  </Box>
                );
              })}
            </Box>

            {/* Right: actions (desktop) + hamburger (mobile) */}
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 1,
              }}
            >
{/* Network toggle pill (desktop) */}
              <Box
                onClick={toggleNetwork}
                sx={{
                  display: { xs: 'none', md: 'flex' },
                  alignItems: 'center',
                  gap: 0.75,
                  px: 1.5,
                  py: 0.625,
                  borderRadius: '100px',
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: network === 'mainnet' ? 'rgba(16,185,129,0.4)' : 'rgba(244,165,84,0.4)',
                  bgcolor: network === 'mainnet' ? 'rgba(16,185,129,0.08)' : 'rgba(244,165,84,0.08)',
                  transition: 'all 0.18s',
                  '&:hover': {
                    bgcolor: network === 'mainnet' ? 'rgba(16,185,129,0.15)' : 'rgba(244,165,84,0.15)',
                  },
                  userSelect: 'none',
                }}
              >
                <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: network === 'mainnet' ? '#10b981' : brandColors.gold }} />
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: network === 'mainnet' ? '#10b981' : brandColors.gold,
                    fontFamily: fontTokens.ui,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    lineHeight: 1,
                  }}
                >
                  {network}
                </Typography>
              </Box>

              {/* Launch App button */}
              <Button
                variant="outlined"
                endIcon={<ArrowRight size={16} />}
                disabled={disabled}
                onClick={handleDemoFallback}
                sx={{
                  borderRadius: '100px',
                  borderColor: brandColors.surfaceBorder,
                  color: brandColors.offWhite,
                  px: 2,
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  textTransform: 'none',
                  minWidth: 88,
                  bgcolor: brandColors.interactiveOverlay,
                  display: { xs: 'none', md: 'inline-flex' },
                  '&:hover': {
                    borderColor: brandColors.purpleLight,
                    bgcolor: brandColors.interactiveOverlayHover,
                  },
                  '&:active': {
                    bgcolor: 'rgba(255,255,255,0.08)',
                  },
                }}
              >
                Launch App
              </Button>

              {/* Mobile: hamburger button */}
              <IconButton
                aria-label="Open navigation menu"
                onClick={() => setDrawerOpen(true)}
                disabled={disabled}
                sx={{
                  display: { xs: 'flex', md: 'none' },
                  color: brandColors.offWhite,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
                }}
              >
                <Menu size={22} />
              </IconButton>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Mobile Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: 260,
            bgcolor: 'rgba(12, 10, 23, 0.98)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderLeft: `1px solid ${brandColors.surfaceBorder}`,
            pt: 2,
            pb: 4,
            px: 2,
            boxSizing: 'border-box',
          },
        }}
      >
        {/* Drawer header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Logo variant="horizontal" size="small" color={brandColors.offWhite} />
          <IconButton
            aria-label="Close navigation menu"
            onClick={() => setDrawerOpen(false)}
            size="small"
            sx={{ color: 'rgba(244,238,255,0.5)', '&:hover': { color: brandColors.offWhite } }}
          >
            <X size={18} />
          </IconButton>
        </Box>

        <Divider sx={{ borderColor: brandColors.surfaceBorder, mb: 2 }} />

        {/* Nav items */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {navItems.map((item) => {
            const isActive = effectiveScreen === item.screen;
            const Icon = item.icon;
            const itemColor = isActive ? brandColors.gold : navTextColor;
            return (
              <Box
                key={item.label}
                onClick={() => handleNavItem(item.screen)}
                aria-current={isActive ? 'page' : undefined}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 2,
                  py: 1.25,
                  borderRadius: 2,
                  cursor: 'pointer',
                  bgcolor: isActive ? 'rgba(244,165,84,0.08)' : 'transparent',
                  border: '1px solid',
                  borderColor: isActive ? 'rgba(244,165,84,0.3)' : 'transparent',
                  transition: 'background-color 0.18s, border-color 0.18s',
                  '&:hover': {
                    bgcolor: 'rgba(244,165,84,0.06)',
                    borderColor: 'rgba(244,165,84,0.15)',
                  },
                }}
              >
                <Icon size={15} color={itemColor} fill={isActive ? itemColor : 'none'} style={{ flexShrink: 0 }} />
                <Typography
                  sx={{
                    fontSize: '0.9375rem',
                    fontWeight: isActive ? 500 : 400,
                    color: itemColor,
                    fontFamily: fontTokens.ui,
                  }}
                >
                  {item.label}
                </Typography>
              </Box>
            );
          })}
        </Box>

        {/* Network toggle (mobile drawer) */}
        <Box sx={{ mt: 3 }}>
          <Box
            onClick={toggleNetwork}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              py: 1.25,
              borderRadius: '100px',
              cursor: 'pointer',
              border: '1px solid',
              borderColor: network === 'mainnet' ? 'rgba(16,185,129,0.4)' : 'rgba(244,165,84,0.4)',
              bgcolor: network === 'mainnet' ? 'rgba(16,185,129,0.08)' : 'rgba(244,165,84,0.08)',
              userSelect: 'none',
            }}
          >
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: network === 'mainnet' ? '#10b981' : brandColors.gold }} />
            <Typography
              sx={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: network === 'mainnet' ? '#10b981' : brandColors.gold,
                fontFamily: fontTokens.ui,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {network}
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'rgba(244,238,255,0.5)', mt: 0.5 }}>
            Tap to switch network
          </Typography>
        </Box>

        {/* Launch App button in drawer */}
        <Box sx={{ mt: 3 }}>
          <Button
            variant="outlined"
            endIcon={<ArrowRight size={16} />}
            disabled={disabled}
            onClick={() => { handleDemoFallback(); setDrawerOpen(false); }}
            fullWidth
            sx={{
              borderRadius: '100px',
              borderColor: brandColors.purpleLight,
              color: brandColors.offWhite,
              fontSize: '0.875rem',
              fontWeight: 500,
              textTransform: 'none',
              py: 1.125,
              bgcolor: 'rgba(103,80,164,0.1)',
              '&:hover': {
                borderColor: brandColors.purpleLight,
                bgcolor: 'rgba(103,80,164,0.18)',
              },
            }}
          >
            Launch App
          </Button>
        </Box>
      </Drawer>
    </>
  );
}
