import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import CssBaseline from '@mui/material/CssBaseline';
import Stack from '@mui/material/Stack';
import { ThemeProvider } from '@mui/material';
import { useEffect, useState } from 'react';
import {
  AberrationSlidersCard,
  AppHeader,
  createDefaultZernikeCoefficients,
  OpticalSystemConfigCard,
  SettingsDrawer,
  SimulatedImageCard,
  type DisplayMode,
  type ThemeMode
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

const defaultTargetId: SupportedTargetId = 'snellen_e_20_20';
const defaultApertureDiameterMm = 3;
const debounceMs = 300;
const computeTimeoutMs = 60_000;

export function App({ workerClient }: AppProps) {
  const { client, diagnostics, setDiagnostics } = useWorkerClient(workerClient);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('basic');
  const [apertureDiameterMm, setApertureDiameterMm] = useState(defaultApertureDiameterMm);
  const [targetId, setTargetId] = useState<SupportedTargetId>(defaultTargetId);
  const [zernikeCoefficients, setZernikeCoefficients] = useState(
    createDefaultZernikeCoefficients
  );
  const [result, setResult] = useState<ConvolvedImageResult | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const theme = useAppTheme(themeMode);
  const visibleAdvancedCardCount = targetId === 'point_source' ? 2 : 3;

  useEffect(() => {
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      setIsLoading(true);
      setError(undefined);

      withTimeout(
        client.api.computeConvolvedImage({
          apertureDiameterMm,
          targetId,
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
  }, [apertureDiameterMm, client, targetId, zernikeCoefficients]);

  const updateZernikeCoefficient = (key: ZernikeCoefficientKey, value: number) => {
    setZernikeCoefficients((currentValues) => ({
      ...currentValues,
      [key]: value
    }));
  };

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
          onClose={() => {
            setSettingsOpen(false);
          }}
          onModeChange={setThemeMode}
          onDisplayModeChange={setDisplayMode}
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
                alignSelf: 'start',
                position: 'sticky',
                top: { xs: 16, sm: 24 },
                zIndex: 3
              }}
            >
              <SimulatedImageCard
                imageUrl={result?.imageUrl}
                statusText={diagnostics.message}
                isLoading={isLoading}
                error={error}
              />
            </Box>
            {displayMode === 'advanced' && targetId !== 'point_source' ? (
              <Box
                sx={{
                  alignSelf: 'start',
                  position: { xs: 'static', sm: 'sticky' },
                  top: { sm: 24 },
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
                  alignSelf: 'start',
                  position: { xs: 'static', sm: 'sticky' },
                  top: { sm: 24 },
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
                onReset={() => {
                  setZernikeCoefficients(createDefaultZernikeCoefficients());
                }}
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
