import { useState, useEffect } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { theme } from '@/theme';
import { LandingPage } from '@/app/components/landing-page';
import { ConsentModal } from '@/app/components/consent-modal';
import { NoTurningBackModal } from '@/app/components/no-turning-back-modal';
import { SetupLoadingScreen } from '@/app/components/setup-loading-screen';
import { RecordingInterface } from '@/app/components/recording-interface';
import { SuccessScreen } from '@/app/components/success-screen';
import { UploadScreen } from '@/app/components/upload-screen';
import { ManualFallbackModal } from '@/app/components/manual-fallback-modal';
import { VerificationLoading } from '@/app/components/verification-loading';
import { VerificationResult } from '@/app/components/verification-result';
import { LivenessFailedScreen } from '@/app/components/liveness-failed-screen';
import { ErrorBoundary } from '@/app/components/error-boundary';
import { DemoScreen } from '@/app/components/demo-screen';
import { InstructionsPage } from '@/app/components/instructions-page';
import { FaqPage } from '@/app/components/faq-page';
import { ContactPage } from '@/app/components/contact-page';
import { DocumentationPage } from '@/app/components/documentation-page';
import { PlatformsPage } from '@/app/components/platforms-page';
import { PrivacyPolicyPage } from '@/app/components/privacy-policy-page';

// ─── Hash routing helpers ──────────────────────────────────────────────────────
// Landing is at /#/ (or just /), app screens are at /#/app
function getPage() {
  const hash = window.location.hash;
  if (hash.startsWith('#/app')) return 'app';
  return 'landing';
}

function goToApp() {
  window.location.hash = '#/app';
}

function goToLanding() {
  window.location.hash = '#/';
}

export default function App() {
  // ─── Hash routing state ─────────────────────────────────────────────────────
  const [page, setPage] = useState(getPage);
  const [currentScreen, setCurrentScreen] = useState(() => getPage() === 'app' ? 'demo' : 'landing');

  // ─── Modal state ────────────────────────────────────────────────────────────
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showNoTurningBackModal, setShowNoTurningBackModal] = useState(false);
  const [consentOrigin, setConsentOrigin] = useState('demo');

  // ─── Recording flow state (real backend) ────────────────────────────────────
  const [recordingData, setRecordingData] = useState(null);
  const [subcontractAddress, setSubcontractAddress] = useState(null);
  const [finalHash, setFinalHash] = useState(null);

  // ─── Verification flow state (real backend) ─────────────────────────────────
  const [uploadedFile, setUploadedFile] = useState(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [verificationResult, setVerificationResult] = useState(null);

  // ─── Hash change listener ───────────────────────────────────────────────────
  useEffect(() => {
    const onHashChange = () => {
      const newPage = getPage();
      setPage(newPage);
      // When navigating back to landing, reset app state
      if (newPage === 'landing') {
        setCurrentScreen('landing');
        setRecordingData(null);
        setVerificationResult(null);
        setSubcontractAddress(null);
        setFinalHash(null);
        setUploadedFile(null);
        setVideoDuration(0);
        setShowConsentModal(false);
        setShowNoTurningBackModal(false);
      }
    };
    window.addEventListener('hashchange', onHashChange);

    const onBedRockNav = (e) => {
      const screen = e.detail?.screen;
      if (screen) {
        setPage('landing');
        setCurrentScreen(screen);
      }
    };
    window.addEventListener('bedrock-nav', onBedRockNav);

    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('bedrock-nav', onBedRockNav);
    };
  }, []);

  // ─── Navigation handlers ───────────────────────────────────────────────────

  const handleDemoClick = () => {
    setCurrentScreen('demo');
    goToApp();
    setPage('app');
  };

  const handleBackToLanding = () => {
    goToLanding();
    setPage('landing');
    setCurrentScreen('landing');
    setRecordingData(null);
    setVerificationResult(null);
    setSubcontractAddress(null);
    setFinalHash(null);
    setUploadedFile(null);
    setVideoDuration(0);
  };

  const handleNavClick = (screen) => {
    // Nav links from landing pages go to landing-level screens
    setPage('landing');
    goToLanding();
    setCurrentScreen(screen);
  };

  // ─── Create Video flow handlers ─────────────────────────────────────────────

  const handleCreateVideo = () => {
    setConsentOrigin('demo');
    setShowConsentModal(true);
  };

  const handleConsentAgree = () => {
    setShowConsentModal(false);
    setShowNoTurningBackModal(true);
  };

  const handleConsentDeny = () => {
    setShowConsentModal(false);
    setShowNoTurningBackModal(false);
    setCurrentScreen(consentOrigin);
  };

  const handleProceedAfterWarning = () => {
    setShowNoTurningBackModal(false);
    setCurrentScreen('setup-loading');
  };

  // Real recording complete handler — receives actual data from AWS Rekognition + blockchain
  const handleRecordingComplete = (timestamp, duration, finalHashHex, videoBlob, recordingStartEpoch) => {
    setRecordingData({ timestamp, duration, videoBlob, recordingStartEpoch });
    setFinalHash(finalHashHex);
    setCurrentScreen('success');
  };

  // ─── Verify Video flow handlers ─────────────────────────────────────────────

  const handleVerifyVideo = () => {
    setCurrentScreen('upload');
  };

  // Upload screen: metadata was found in video -> go straight to verification
  const handleUploadVerifyWithAddress = (file, address, duration) => {
    setUploadedFile(file);
    setVideoDuration(duration);
    setSubcontractAddress(address);
    setCurrentScreen('verification-loading');
  };

  // Upload screen: no metadata found -> need manual address entry
  const handleUploadNeedsAddress = (file, duration) => {
    setUploadedFile(file);
    setVideoDuration(duration);
    setCurrentScreen('manual-fallback');
  };

  // Manual fallback: user entered address -> proceed to verification
  const handleManualVerify = (address) => {
    setSubcontractAddress(address);
    setCurrentScreen('verification-loading');
  };

  // Verification loading: API call completed
  const handleVerificationComplete = (result) => {
    setVerificationResult(result);
    setCurrentScreen('verification-result');
  };

  // Verification loading: API call failed
  const handleVerificationError = (error) => {
    setVerificationResult({ error: error.message || 'Verification failed' });
    setCurrentScreen('verification-result');
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  // Landing page routing
  if (page === 'landing') {
    const landingNav = (s) => setCurrentScreen(s);
    const landingHome = () => setCurrentScreen('landing');
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ErrorBoundary>
          {currentScreen === 'landing' && (
            <LandingPage onDemoClick={handleDemoClick} onNavClick={landingNav} currentScreen="landing" />
          )}
          {currentScreen === 'instructions' && (
            <InstructionsPage onLogoClick={landingHome} onNavClick={landingNav} currentScreen={currentScreen} />
          )}
          {currentScreen === 'faq' && (
            <FaqPage onLogoClick={landingHome} onNavClick={landingNav} currentScreen={currentScreen} />
          )}
          {currentScreen === 'contact' && (
            <ContactPage onLogoClick={landingHome} onNavClick={landingNav} currentScreen={currentScreen} />
          )}
          {currentScreen === 'documentation' && (
            <DocumentationPage onLogoClick={landingHome} onNavClick={landingNav} currentScreen={currentScreen} />
          )}
          {currentScreen === 'platforms' && (
            <PlatformsPage onLogoClick={landingHome} onNavClick={landingNav} currentScreen={currentScreen} />
          )}
          {currentScreen === 'privacy' && (
            <PrivacyPolicyPage onLogoClick={landingHome} onNavClick={landingNav} currentScreen={currentScreen} />
          )}
        </ErrorBoundary>
      </ThemeProvider>
    );
  }

  // App page — all real backend-connected screens
  const content = (
    <>
      {currentScreen === 'demo' && (
        <DemoScreen
          onCreateVideo={handleCreateVideo}
          onVerifyVideo={handleVerifyVideo}
          onLogoClick={handleBackToLanding}
        />
      )}

      {currentScreen === 'setup-loading' && (
        <SetupLoadingScreen
          onComplete={(addr) => {
            setSubcontractAddress(addr);
            setCurrentScreen('recording');
          }}
        />
      )}

      {currentScreen === 'recording' && (
        <RecordingInterface
          subcontractAddress={subcontractAddress}
          onComplete={handleRecordingComplete}
          onLivenessFail={() => {
            setCurrentScreen('liveness-failed');
          }}
        />
      )}

      {currentScreen === 'liveness-failed' && (
        <LivenessFailedScreen
          onRetry={() => {
            setSubcontractAddress(null);
            setCurrentScreen('setup-loading');
          }}
          onBack={handleBackToLanding}
        />
      )}

      {currentScreen === 'success' && recordingData && (
        <SuccessScreen
          timestamp={recordingData.timestamp}
          duration={recordingData.duration}
          videoBlob={recordingData.videoBlob}
          recordingStartEpoch={recordingData.recordingStartEpoch}
          subcontractAddress={subcontractAddress}
          finalHash={finalHash}
          onBack={handleBackToLanding}
          onCreateAnother={() => {
            setRecordingData(null);
            setFinalHash(null);
            setSubcontractAddress(null);
            setConsentOrigin('demo');
            setCurrentScreen('demo');
            setShowConsentModal(true);
          }}
        />
      )}

      {currentScreen === 'upload' && (
        <UploadScreen
          onVerify={handleUploadVerifyWithAddress}
          onBack={handleBackToLanding}
        />
      )}

      {currentScreen === 'manual-fallback' && (
        <ManualFallbackModal
          onVerify={handleManualVerify}
          onBack={() => setCurrentScreen('upload')}
        />
      )}

      {currentScreen === 'verification-loading' && uploadedFile && (
        <VerificationLoading
          file={uploadedFile}
          subcontractAddress={subcontractAddress}
          videoDurationSeconds={videoDuration}
          onComplete={handleVerificationComplete}
          onError={handleVerificationError}
          onBack={handleBackToLanding}
        />
      )}

      {currentScreen === 'verification-result' && verificationResult && (
        <VerificationResult
          result={verificationResult}
          videoFile={uploadedFile}
          onBack={handleBackToLanding}
          onVerifyAnother={() => {
            setVerificationResult(null);
            setUploadedFile(null);
            setVideoDuration(0);
            setSubcontractAddress(null);
            setCurrentScreen('upload');
          }}
        />
      )}

      <ConsentModal isOpen={showConsentModal} onAgree={handleConsentAgree} onDeny={handleConsentDeny} />

      <NoTurningBackModal
        isOpen={showNoTurningBackModal}
        onProceed={handleProceedAfterWarning}
        onCancel={handleConsentDeny}
      />
    </>
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        {content}
      </ErrorBoundary>
    </ThemeProvider>
  );
}
