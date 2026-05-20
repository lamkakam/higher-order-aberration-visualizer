import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import CssBaseline from '@mui/material/CssBaseline';
import Stack from '@mui/material/Stack';
import { ThemeProvider } from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useAppTheme } from '../../hooks/useAppTheme';
import i18n, { resolveSupportedLanguage, type SupportedLanguageCode } from '../../i18n';
import type { WorkerClient } from '../../workers/client';
import { AppHeader } from '../AppHeader';
import { OpticalSystemConfigCard } from '../OpticalSystemConfigCard';
import {
  SettingsDrawer,
  type DisplayMode,
  type ThemeMode
} from '../SettingsDrawer';
import {
  TermsOfUseModal,
  termsOfUseAcceptedStorageKey
} from '../TermsOfUseModal';
import { AberrationControlsPanel } from './AberrationControlsPanel';
import { ApproximateStrehlSummary } from './ApproximateStrehlSummary';
import { SimulatorResults } from './SimulatorResults';
import { WorkerInitializationMask } from './WorkerInitializationMask';
import { createAppPath, isDisplayMode, isSupportedLanguageCode } from '../../routing';
import { useSimulationState } from './hooks/useSimulationState';

interface ApplicationShellProps {
  readonly workerClient?: WorkerClient;
}

export function ApplicationShell({ workerClient }: ApplicationShellProps) {
  const [location, navigate] = useLocation();
  const [matchedRoute, routeParams] = useRoute('/:lang/:mode');
  const routeLanguage = matchedRoute ? routeParams.lang : undefined;
  const routeDisplayMode = matchedRoute ? routeParams.mode : undefined;
  const hasValidRouteState =
    isSupportedLanguageCode(routeLanguage) && isDisplayMode(routeDisplayMode);
  const selectedLanguage = hasValidRouteState ? routeLanguage : resolveSupportedLanguage();
  const displayMode = hasValidRouteState ? routeDisplayMode : 'basic';
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(
    () => window.localStorage.getItem(termsOfUseAcceptedStorageKey) !== 'true'
  );
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const theme = useAppTheme(themeMode);
  const isSmUp = useMediaQuery(theme.breakpoints.up('sm'));
  const simulation = useSimulationState({ displayMode, workerClient });
  const shouldWrapPolychromaticStrehl = simulation.isPolychromatic && !isSmUp;
  const approximateStrehlContent =
    displayMode === 'advanced' ? (
      <ApproximateStrehlSummary
        isPolychromatic={simulation.isPolychromatic}
        shouldWrapPolychromaticStrehl={shouldWrapPolychromaticStrehl}
        simulationWavelengths={simulation.simulationWavelengths}
        zernikeCoefficientsByWavelength={simulation.zernikeCoefficientsByWavelength}
      />
    ) : undefined;

  useEffect(() => {
    const normalizedPath = createAppPath(selectedLanguage, displayMode);

    if (location !== normalizedPath) {
      navigate(normalizedPath, { replace: true });
    }
  }, [displayMode, location, navigate, selectedLanguage]);

  useEffect(() => {
    if (i18n.resolvedLanguage !== selectedLanguage) {
      void i18n.changeLanguage(selectedLanguage);
    }
  }, [selectedLanguage]);

  const updateSelectedLanguage = useCallback(
    (nextLanguage: SupportedLanguageCode) => {
      navigate(createAppPath(nextLanguage, displayMode));
    },
    [displayMode, navigate]
  );

  const updateDisplayMode = useCallback(
    (nextDisplayMode: DisplayMode) => {
      navigate(createAppPath(selectedLanguage, nextDisplayMode));
    },
    [navigate, selectedLanguage]
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <AppHeader
          onOpenSettings={() => {
            setSettingsOpen(true);
          }}
        />
        <SettingsDrawer
          open={settingsOpen}
          selectedLanguage={selectedLanguage}
          mode={themeMode}
          displayMode={displayMode}
          showScaleBar={simulation.showScaleBar}
          onClose={() => {
            setSettingsOpen(false);
          }}
          onLanguageChange={updateSelectedLanguage}
          onModeChange={setThemeMode}
          onDisplayModeChange={updateDisplayMode}
          onShowScaleBarChange={simulation.setShowScaleBar}
        />
        <TermsOfUseModal
          open={termsOpen}
          onAgree={() => {
            window.localStorage.setItem(termsOfUseAcceptedStorageKey, 'true');
            setTermsOpen(false);
          }}
        />
        <Container component="main" maxWidth="lg" sx={{ py: 3 }}>
          <Box
            sx={{
              display: 'grid',
              gap: 3,
              gridTemplateColumns: '1fr'
            }}
          >
            <SimulatorResults
              approximateStrehlContent={approximateStrehlContent}
              diagnosticsMessage={simulation.diagnostics.message}
              displayMode={displayMode}
              error={simulation.error}
              isImageLoading={simulation.isImageLoading}
              isSmUp={isSmUp}
              result={simulation.result}
              targetId={simulation.targetId}
              wavefrontLegendUnit={simulation.wavefrontLegendUnit}
              onWavefrontLegendUnitChange={simulation.setWavefrontLegendUnit}
            />
            <Stack spacing={3} sx={{ gridColumn: '1 / -1' }}>
              <OpticalSystemConfigCard
                apertureDiameterMm={simulation.apertureDiameterMm}
                apertureSettings={simulation.apertureSettings}
                displayMode={displayMode}
                spectralMode={simulation.spectralMode}
                targetId={simulation.targetId}
                onApertureChange={simulation.setApertureDiameterMm}
                onApertureSettingsChange={simulation.setApertureSettings}
                onRenderApertureMask={simulation.renderApertureMask}
                onSpectralModeChange={simulation.updateSpectralMode}
                onTargetChange={simulation.setTargetId}
              />
              <AberrationControlsPanel
                isPolychromatic={simulation.isPolychromatic}
                selectedWavelength={simulation.selectedWavelength}
                syncWavelengthCoefficients={simulation.syncWavelengthCoefficients}
                zernikeCoefficients={simulation.zernikeCoefficients}
                zernikeCoefficientsByWavelength={simulation.zernikeCoefficientsByWavelength}
                onResetAllWavelengths={simulation.resetAllZernikeCoefficientsByWavelength}
                onResetZernikeCoefficients={simulation.resetZernikeCoefficients}
                onSelectedWavelengthChange={simulation.setSelectedWavelength}
                onSyncWavelengthCoefficientsChange={simulation.setSyncWavelengthCoefficients}
                onZernikeCoefficientChange={simulation.updateZernikeCoefficient}
              />
            </Stack>
          </Box>
        </Container>
        {simulation.isWorkerInitializing ? <WorkerInitializationMask theme={theme} /> : undefined}
      </Box>
    </ThemeProvider>
  );
}
