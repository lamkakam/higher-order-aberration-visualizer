import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import CssBaseline from '@mui/material/CssBaseline';
import Stack from '@mui/material/Stack';
import { createTheme, ThemeProvider, useMediaQuery } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import {
  AberrationSlidersCard,
  AppHeader,
  createDefaultZernikeCoefficients,
  OpticalSystemConfigCard,
  SettingsDrawer,
  SimulatedImageCard,
  type ThemeMode
} from './components';
import { createWorkerClient, type WorkerClient } from './workers/client';
import type {
  ConvolvedImageResult,
  SupportedTargetId,
  WorkerDiagnostics,
  ZernikeCoefficientKey
} from './workers/types';

interface AppProps {
  readonly workerClient?: WorkerClient;
}

const initialDiagnostics: WorkerDiagnostics = {
  status: 'idle',
  message: 'Worker not initialized'
};

const defaultTargetId: SupportedTargetId = 'snellen_e_20_20';
const defaultApertureDiameterMm = 3;
const debounceMs = 300;
const computeTimeoutMs = 60_000;

export function App({ workerClient }: AppProps) {
  const [ownedClient, setOwnedClient] = useState<WorkerClient | undefined>(undefined);
  const client = workerClient ?? ownedClient;
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [diagnostics, setDiagnostics] = useState<WorkerDiagnostics>(initialDiagnostics);
  const [apertureDiameterMm, setApertureDiameterMm] = useState(defaultApertureDiameterMm);
  const [targetId, setTargetId] = useState<SupportedTargetId>(defaultTargetId);
  const [zernikeCoefficients, setZernikeCoefficients] = useState(
    createDefaultZernikeCoefficients
  );
  const [result, setResult] = useState<ConvolvedImageResult | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const resolvedMode = themeMode === 'system' ? (prefersDarkMode ? 'dark' : 'light') : themeMode;
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: resolvedMode,
          primary: {
            main: '#256f72'
          },
          secondary: {
            main: '#8a5a2b'
          },
          background: {
            default: resolvedMode === 'dark' ? '#101418' : '#f5f6f1'
          }
        },
        shape: {
          borderRadius: 8
        }
      }),
    [resolvedMode]
  );

  useEffect(() => {
    if (workerClient) {
      setOwnedClient(undefined);
      return undefined;
    }

    const nextClient = createWorkerClient();
    setOwnedClient(nextClient);

    return () => {
      nextClient.dispose();
    };
  }, [workerClient]);

  useEffect(() => {
    if (!client) {
      return undefined;
    }

    let cancelled = false;

    setDiagnostics({
      status: 'initializing',
      message: 'Starting worker'
    });

    client.api
      .initialize()
      .then((nextDiagnostics) => {
        if (!cancelled) {
          setDiagnostics(nextDiagnostics);
        }
      })
      .catch((caughtError) => {
        if (!cancelled) {
          setDiagnostics({
            status: 'error',
            message:
              caughtError instanceof Error ? caughtError.message : 'Worker failed to initialize'
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client]);

  useEffect(() => {
    if (!client) {
      return undefined;
    }

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

  function updateZernikeCoefficient(key: ZernikeCoefficientKey, value: number) {
    setZernikeCoefficients((currentValues) => ({
      ...currentValues,
      [key]: value
    }));
  }

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
          onClose={() => {
            setSettingsOpen(false);
          }}
          onModeChange={setThemeMode}
        />
        <Container component="main" maxWidth="lg" sx={{ py: 3 }}>
          <Stack spacing={3}>
            <SimulatedImageCard
              imageUrl={result?.imageUrl}
              statusText={diagnostics.message}
              isLoading={isLoading}
              error={error}
            />
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
