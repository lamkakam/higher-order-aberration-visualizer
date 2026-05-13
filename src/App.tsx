import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Container from '@mui/material/Container';
import CssBaseline from '@mui/material/CssBaseline';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { ThemeProvider } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AberrationSlidersCard,
  AppHeader,
  createDefaultZernikeCoefficients,
  OpticalSystemConfigCard,
  SettingsDrawer,
  SimulatedImageCard,
  supplementalDescriptions,
  targetOptions,
  type DisplayMode,
  type ThemeMode,
  type WavefrontLegendUnit
} from './components';
import { useAppTheme } from './hooks/useAppTheme';
import { useWorkerClient } from './hooks/useWorkerClient';
import type { WorkerClient } from './workers/client';
import type {
  ApertureSettings,
  ConvolvedImageResult,
  SpectralMode,
  SupportedTargetId,
  ZernikeCoefficientKey
} from './workers/types';

interface AppProps {
  readonly workerClient?: WorkerClient;
}

const defaultTargetId: SupportedTargetId = 'logmar_chart';
const defaultApertureDiameterMm = 6;
const defaultApertureSettings: ApertureSettings = {
  shape: 'circle',
  rotationDegrees: 0,
  centralObstructionShape: 'circle',
  centralObstructionRotationDegrees: 0,
  centralObstructionRatio: 0,
  spiderVaneCount: 0,
  spiderVaneWidthRatio: 0,
  spiderVaneRotationDegrees: 0,
  gaussianApodizationEnabled: false,
  gaussianApodizationSigmaRatio: 0.5
};
const debounceMs = 300;
const computeTimeoutMs = 60_000;
const mobileStickyTopPx = 16;
const desktopStickyTopPx = 24;
const advancedGridHalfGapPx = 12;
const wavefrontLegendUnitOptions = [
  { value: 'wave', label: 'Wave' },
  { value: 'micron', label: 'Micron' }
] as const;
const spectralWavelengths = [550, 656, 486] as const;
type SpectralWavelength = (typeof spectralWavelengths)[number];
type ZernikeCoefficientMap = Record<ZernikeCoefficientKey, number>;
type ZernikeCoefficientsByWavelength = Record<SpectralWavelength, ZernikeCoefficientMap>;

function createDefaultZernikeCoefficientsByWavelength(): ZernikeCoefficientsByWavelength {
  return {
    550: createDefaultZernikeCoefficients(),
    656: createDefaultZernikeCoefficients(),
    486: createDefaultZernikeCoefficients()
  };
}

export function App({ workerClient }: AppProps) {
  const { client, diagnostics, setDiagnostics } = useWorkerClient(workerClient);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('basic');
  const [showScaleBar, setShowScaleBar] = useState(false);
  const [spectralMode, setSpectralMode] = useState<SpectralMode>('monochromatic');
  const [selectedWavelength, setSelectedWavelength] = useState<SpectralWavelength>(550);
  const [wavefrontLegendUnit, setWavefrontLegendUnit] =
    useState<WavefrontLegendUnit>('wave');
  const [apertureDiameterMm, setApertureDiameterMm] = useState(defaultApertureDiameterMm);
  const [apertureSettings, setApertureSettings] = useState(defaultApertureSettings);
  const [targetId, setTargetId] = useState<SupportedTargetId>(defaultTargetId);
  const [zernikeCoefficientsByWavelength, setZernikeCoefficientsByWavelength] = useState(
    createDefaultZernikeCoefficientsByWavelength
  );
  const [result, setResult] = useState<ConvolvedImageResult | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const theme = useAppTheme(themeMode);
  const isWorkerInitializing = diagnostics.status === 'initializing';
  const isImageLoading = isLoading && !isWorkerInitializing;
  const selectedTarget = targetOptions.find((target) => target.id === targetId) ?? targetOptions[0];
  const simulatedImageDescription = `This shows how the selected picture would look through the current optical settings. Current target: ${selectedTarget.description}`;
  const psfSupplementalDescription = supplementalDescriptions[targetId];
  const visibleAdvancedCardCount = targetId === 'point_source' ? 2 : 3;
  const desktopAdvancedMaskOffset = displayMode === 'advanced' ? `-${advancedGridHalfGapPx}px` : 0;
  const stickyImageCardMaskSx = {
    '&::before': {
      bgcolor: 'background.default',
      bottom: 0,
      content: '""',
      left: { xs: 0, sm: desktopAdvancedMaskOffset },
      position: 'absolute',
      right: { xs: 0, sm: desktopAdvancedMaskOffset },
      top: { xs: `-${mobileStickyTopPx}px`, sm: `-${desktopStickyTopPx}px` }
    },
    '& > *': {
      position: 'relative',
      zIndex: 1
    }
  };
  const desktopStickyImageCardMaskSx = {
    ...stickyImageCardMaskSx,
    '&::before': {
      ...stickyImageCardMaskSx['&::before'],
      display: { xs: 'none', sm: 'block' }
    }
  };
  const zernikeCoefficients = zernikeCoefficientsByWavelength[550];
  const effectiveSpectralMode: SpectralMode =
    displayMode === 'advanced' ? spectralMode : 'monochromatic';
  const isPolychromatic = effectiveSpectralMode === 'polychromatic';
  const simulationWavelengths = useMemo(
    () => (isPolychromatic ? spectralWavelengths : ([550] as const)),
    [isPolychromatic]
  );
  const wavelengthWeights = useMemo(
    () => simulationWavelengths.map((wavelength) => [wavelength, 1] as const),
    [simulationWavelengths]
  );
  const simulationCoefficientsByWavelength = useMemo(
    () =>
      simulationWavelengths.map(
        (wavelength) => [wavelength, zernikeCoefficientsByWavelength[wavelength]] as const
      ),
    [simulationWavelengths, zernikeCoefficientsByWavelength]
  );

  useEffect(() => {
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      setIsLoading(true);
      setError(undefined);

      withTimeout(
        client.api.computeConvolvedImage({
          apertureSettings,
          apertureDiameterMm,
          showScaleBar,
          spectralMode: effectiveSpectralMode,
          targetId,
          wavelengthWeights,
          wavefrontLegendUnit,
          zernikeCoefficientsByWavelength: simulationCoefficientsByWavelength
        }),
        computeTimeoutMs
      )
        .then((nextResult) => {
          if (!cancelled) {
            setResult(nextResult);
            setDiagnostics(nextResult.diagnostics);
            setError(undefined);
          }
        })
        .catch((caughtError) => {
          if (!cancelled) {
            setError(caughtError instanceof Error ? caughtError.message : 'Simulation failed');
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoading(false);
          }
        });
    }, debounceMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    apertureDiameterMm,
    apertureSettings,
    client,
    effectiveSpectralMode,
    showScaleBar,
    targetId,
    wavefrontLegendUnit,
    simulationCoefficientsByWavelength,
    wavelengthWeights
  ]);

  const updateZernikeCoefficient = useCallback(
    (wavelength: SpectralWavelength, key: ZernikeCoefficientKey, value: number) => {
      setZernikeCoefficientsByWavelength((currentValues) => ({
        ...currentValues,
        [wavelength]: {
          ...currentValues[wavelength],
          [key]: value
        }
      }));
    },
    []
  );

  const resetZernikeCoefficients = useCallback((wavelength: SpectralWavelength) => {
    setZernikeCoefficientsByWavelength((currentValues) => ({
      ...currentValues,
      [wavelength]: createDefaultZernikeCoefficients()
    }));
  }, []);

  const updateSpectralMode = useCallback((nextMode: SpectralMode) => {
    setSpectralMode(nextMode);
    if (nextMode === 'polychromatic') {
      setSelectedWavelength(550);
    }
  }, []);

  const renderApertureMask = useCallback(
    (nextApertureSettings: ApertureSettings) =>
      client.api.renderApertureMask(nextApertureSettings),
    [client]
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
          mode={themeMode}
          displayMode={displayMode}
          showScaleBar={showScaleBar}
          onClose={() => {
            setSettingsOpen(false);
          }}
          onModeChange={setThemeMode}
          onDisplayModeChange={setDisplayMode}
          onShowScaleBarChange={setShowScaleBar}
        />
        <Container component="main" maxWidth="lg" sx={{ py: 3 }}>
          <Box
            sx={{
              display: 'grid',
              gap: 3,
              gridTemplateColumns:
                displayMode === 'advanced'
                  ? {
                      xs: '1fr',
                      sm: `repeat(${visibleAdvancedCardCount}, minmax(0, 1fr))`
                    }
                  : '1fr'
            }}
          >
            <Box
              sx={{
                ...stickyImageCardMaskSx,
                alignSelf: { xs: 'start', sm: 'stretch' },
                position: 'sticky',
                top: { xs: mobileStickyTopPx, sm: desktopStickyTopPx },
                zIndex: 3
              }}
            >
              <SimulatedImageCard
                imageUrl={result?.imageUrl}
                statusText={diagnostics.message}
                isLoading={isImageLoading}
                error={error}
                description={simulatedImageDescription}
              />
            </Box>
            {displayMode === 'advanced' && targetId !== 'point_source' ? (
              <Box
                sx={{
                  ...desktopStickyImageCardMaskSx,
                  alignSelf: { xs: 'start', sm: 'stretch' },
                  position: { xs: 'static', sm: 'sticky' },
                  top: { sm: desktopStickyTopPx },
                  zIndex: { sm: 2 }
                }}
              >
                <SimulatedImageCard
                  imageUrl={result?.psfImageUrl}
                  statusText={diagnostics.message}
                  isLoading={isImageLoading}
                  error={error}
                  title="PSF"
                  description="The rendered point spread function for the current optical system."
                  supplementalDescription={psfSupplementalDescription}
                  altText="Rendered point spread function"
                />
              </Box>
            ) : undefined}
            {displayMode === 'advanced' ? (
              <Box
                sx={{
                  ...desktopStickyImageCardMaskSx,
                  alignSelf: { xs: 'start', sm: 'stretch' },
                  position: { xs: 'static', sm: 'sticky' },
                  top: { sm: desktopStickyTopPx },
                  zIndex: { sm: 2 }
                }}
              >
                <SimulatedImageCard
                  imageUrl={result?.wavefrontImageUrl}
                  statusText={diagnostics.message}
                  isLoading={isImageLoading}
                  error={error}
                  title="Wavefront Map"
                  description="The rendered wavefront map for the current Zernike aberration values."
                  altText="Rendered wavefront map"
                  bottomContent={
                    <Box>
                      <Typography
                        id="wavefront-legend-unit-button-group-label"
                        variant="subtitle1"
                        sx={{ mb: 1 }}
                      >
                        Legend Unit
                      </Typography>
                      <ButtonGroup
                        aria-labelledby="wavefront-legend-unit-button-group-label"
                        fullWidth
                      >
                        {wavefrontLegendUnitOptions.map((option) => (
                          <Button
                            key={option.value}
                            aria-label={option.label}
                            variant={
                              wavefrontLegendUnit === option.value ? 'contained' : 'outlined'
                            }
                            onClick={() => {
                              setWavefrontLegendUnit(option.value);
                            }}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </ButtonGroup>
                    </Box>
                  }
                />
              </Box>
            ) : undefined}
            <Stack spacing={3} sx={{ gridColumn: '1 / -1' }}>
              <OpticalSystemConfigCard
                apertureDiameterMm={apertureDiameterMm}
                apertureSettings={apertureSettings}
                displayMode={displayMode}
                spectralMode={spectralMode}
                targetId={targetId}
                onApertureChange={setApertureDiameterMm}
                onApertureSettingsChange={setApertureSettings}
                onRenderApertureMask={renderApertureMask}
                onSpectralModeChange={updateSpectralMode}
                onTargetChange={setTargetId}
              />
              {isPolychromatic ? (
                <Stack spacing={2}>
                  <Tabs
                    aria-label="Polychromatic wavelength"
                    value={selectedWavelength}
                    onChange={(_, nextWavelength: SpectralWavelength) => {
                      setSelectedWavelength(nextWavelength);
                    }}
                  >
                    {spectralWavelengths.map((wavelength) => (
                      <Tab
                        key={wavelength}
                        label={`${wavelength} nm`}
                        value={wavelength}
                      />
                    ))}
                  </Tabs>
                  <AberrationSlidersCard
                    values={zernikeCoefficientsByWavelength[selectedWavelength]}
                    onValueChange={(key, value) => {
                      updateZernikeCoefficient(selectedWavelength, key, value);
                    }}
                    onReset={() => {
                      resetZernikeCoefficients(selectedWavelength);
                    }}
                  />
                </Stack>
              ) : (
                <AberrationSlidersCard
                  values={zernikeCoefficients}
                  onValueChange={(key, value) => {
                    updateZernikeCoefficient(550, key, value);
                  }}
                  onReset={() => {
                    resetZernikeCoefficients(550);
                  }}
                />
              )}
            </Stack>
          </Box>
        </Container>
        {isWorkerInitializing ? (
          <Box
            role="status"
            aria-label="Worker initialization"
            sx={{
              alignItems: 'center',
              backdropFilter: 'blur(2px)',
              bgcolor: alpha(theme.palette.background.default, 0.86),
              display: 'flex',
              inset: 0,
              justifyContent: 'center',
              p: 3,
              position: 'fixed',
              zIndex: theme.zIndex.modal + 1
            }}
          >
            <Stack spacing={2} sx={{ width: 'min(320px, 100%)' }}>
              <Typography variant="h6" component="p" sx={{ textAlign: 'center' }}>
                Initializing...
              </Typography>
              <LinearProgress aria-label="Initialization progress" />
            </Stack>
          </Box>
        ) : undefined}
      </Box>
    </ThemeProvider>
  );
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error('Compute failed: worker is still initializing'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}
