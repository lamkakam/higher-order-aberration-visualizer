import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Container from '@mui/material/Container';
import CssBaseline from '@mui/material/CssBaseline';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ThemeProvider } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import {
  AberrationSlidersCard,
  AppHeader,
  createDefaultZernikeCoefficients,
  OpticalSystemConfigCard,
  SettingsDrawer,
  SimulatedImageCard,
  targetOptions,
  type DisplayMode,
  type ThemeMode,
  type WavefrontLegendUnit
} from './components';
import { useAppTheme } from './hooks/useAppTheme';
import { useWorkerClient } from './hooks/useWorkerClient';
import type { WorkerClient } from './workers/client';
import type {
  ConvolvedImageResult,
  SupportedTargetId,
  ZernikeCoefficientKey
} from './workers/types';

interface AppProps {
  readonly workerClient?: WorkerClient;
}

const defaultTargetId: SupportedTargetId = 'logmar_chart';
const defaultApertureDiameterMm = 6;
const debounceMs = 300;
const computeTimeoutMs = 60_000;
const mobileStickyTopPx = 16;
const desktopStickyTopPx = 24;
const advancedGridHalfGapPx = 12;
const wavefrontLegendUnitOptions = [
  { value: 'wave', label: 'Wave' },
  { value: 'micron', label: 'Micron' }
] as const;

export function App({ workerClient }: AppProps) {
  const { client, diagnostics, setDiagnostics } = useWorkerClient(workerClient);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('basic');
  const [showScaleBar, setShowScaleBar] = useState(false);
  const [wavefrontLegendUnit, setWavefrontLegendUnit] =
    useState<WavefrontLegendUnit>('wave');
  const [apertureDiameterMm, setApertureDiameterMm] = useState(defaultApertureDiameterMm);
  const [targetId, setTargetId] = useState<SupportedTargetId>(defaultTargetId);
  const [zernikeCoefficients, setZernikeCoefficients] = useState(
    createDefaultZernikeCoefficients
  );
  const [result, setResult] = useState<ConvolvedImageResult | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const theme = useAppTheme(themeMode);
  const selectedTarget = targetOptions.find((target) => target.id === targetId) ?? targetOptions[0];
  const simulatedImageDescription = `This shows how the selected picture would look through the current optical settings. Current target: ${selectedTarget.description}`;
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

  useEffect(() => {
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      setIsLoading(true);
      setError(undefined);

      withTimeout(
        client.api.computeConvolvedImage({
          apertureDiameterMm,
          showScaleBar,
          targetId,
          wavefrontLegendUnit,
          zernikeCoefficients
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
    client,
    showScaleBar,
    targetId,
    wavefrontLegendUnit,
    zernikeCoefficients
  ]);

  const updateZernikeCoefficient = useCallback((key: ZernikeCoefficientKey, value: number) => {
    setZernikeCoefficients((currentValues) => ({
      ...currentValues,
      [key]: value
    }));
  }, []);

  const resetZernikeCoefficients = useCallback(() => {
    setZernikeCoefficients(createDefaultZernikeCoefficients());
  }, []);

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
                isLoading={isLoading}
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
                  isLoading={isLoading}
                  error={error}
                  title="PSF"
                  description="The rendered point spread function for the current optical system."
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
                  isLoading={isLoading}
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
                targetId={targetId}
                onApertureChange={setApertureDiameterMm}
                onTargetChange={setTargetId}
              />
              <AberrationSlidersCard
                values={zernikeCoefficients}
                onValueChange={updateZernikeCoefficient}
                onReset={resetZernikeCoefficients}
              />
            </Stack>
          </Box>
        </Container>
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
