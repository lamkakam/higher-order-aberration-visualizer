import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Container from '@mui/material/Container';
import CssBaseline from '@mui/material/CssBaseline';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { ThemeProvider } from '@mui/material';
import { alpha } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState
} from 'react';
import {
  AberrationSlidersCard,
  AppHeader,
  approximateStrehlRatio,
  createDefaultZernikeCoefficients,
  formatApproximateStrehlRatio,
  ImageResultDetailsContent,
  ImageResultPreview,
  OpticalSystemConfigCard,
  SettingsDrawer,
  SimulatedImageCard,
  supplementalDescriptions,
  targetOptions,
  type DisplayMode,
  type ImageResultPanelProps,
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
type AdvancedResultPanel = ImageResultPanelProps & {
  readonly id: string;
};

interface AdvancedResultCardProps {
  readonly panels: readonly AdvancedResultPanel[];
  readonly sharedAboveAccordionContent?: ReactNode;
}

function AdvancedResultCard({ panels, sharedAboveAccordionContent }: AdvancedResultCardProps) {
  const gridTemplateColumns = `repeat(${panels.length}, minmax(0, 1fr))`;
  const showSharedEnlargementHint = panels.some(
    (panel) => !panel.error && (panel.isLoading || (Boolean(panel.imageUrl) && !panel.isLoading))
  );
  const accordionId = useId();

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns }}>
          {panels.map((panel) => (
            <ImageResultPreview key={panel.id} {...panel} />
          ))}
        </Box>
        {sharedAboveAccordionContent}
        <Accordion
          defaultExpanded
          disableGutters
          sx={{
            '&::before': {
              display: 'none'
            },
            border: 1,
            borderColor: 'divider',
            boxShadow: 'none'
          }}
        >
          <AccordionSummary
            aria-controls={`${accordionId}-content`}
            aria-label="Image Descriptions"
            expandIcon={<ExpandMoreIcon />}
            id={`${accordionId}-header`}
          >
            <Typography variant="h6" component="span">
              Image Descriptions
            </Typography>
          </AccordionSummary>
          <AccordionDetails
            id={`${accordionId}-content`}
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns,
              pt: 0
            }}
          >
            {panels.map((panel, index) => {
              const title = panel.title ?? 'Simulated Image';

              return (
                <Box
                  key={panel.id}
                  role="group"
                  aria-label={`${title} description`}
                  sx={{
                    borderLeft: index === 0 ? 0 : 1,
                    borderColor: 'divider',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                    px: 2,
                    '&:first-of-type': {
                      pl: 0
                    }
                  }}
                >
                  <Typography variant="subtitle2">{title}</Typography>
                  <ImageResultDetailsContent
                    description={
                      panel.description ??
                      'This shows how the selected picture would look through the current optical settings.'
                    }
                    supplementalDescription={panel.supplementalDescription}
                    showEnlargementHint={false}
                    bottomContent={panel.bottomContent}
                  />
                </Box>
              );
            })}
            {showSharedEnlargementHint ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ gridColumn: '1 / -1' }}
              >
                Click the image to view it enlarged.
              </Typography>
            ) : undefined}
          </AccordionDetails>
        </Accordion>
      </CardContent>
    </Card>
  );
}

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
  const isSmUp = useMediaQuery(theme.breakpoints.up('sm'));
  const isWorkerInitializing = diagnostics.status === 'initializing';
  const isImageLoading = isLoading && !isWorkerInitializing;
  const selectedTarget = targetOptions.find((target) => target.id === targetId) ?? targetOptions[0];
  const simulatedImageDescription = `This shows how the selected picture would look through the current optical settings. Current target: ${selectedTarget.description}`;
  const psfSupplementalDescription = supplementalDescriptions[targetId];
  const desktopAdvancedMaskOffset = displayMode === 'advanced' ? `-${advancedGridHalfGapPx}px` : 0;
  const shouldMergeAdvancedResults = displayMode === 'advanced' && isSmUp;
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
  const diagnosticWavelengthNm = isPolychromatic ? selectedWavelength : 550;
  const approximateStrehlContent =
    displayMode === 'advanced' ? (
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: 'center',
          minWidth: 0,
          overflowX: 'auto',
          whiteSpace: 'nowrap'
        }}
      >
        {isPolychromatic ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              Approx. Strehl Ratio:
            </Typography>
            {simulationWavelengths.map((wavelength, index) => (
              <Fragment key={wavelength}>
                {index > 0 ? <Divider flexItem orientation="vertical" /> : undefined}
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  {wavelength} nm:{' '}
                  {(
                    approximateStrehlRatio(zernikeCoefficientsByWavelength[wavelength]) * 100
                  ).toFixed(1)}
                  %
                </Typography>
              </Fragment>
            ))}
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {formatApproximateStrehlRatio(zernikeCoefficientsByWavelength[550])}
          </Typography>
        )}
      </Stack>
    ) : undefined;

  useEffect(() => {
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      setIsLoading(true);
      setError(undefined);

      withTimeout(
        client.api.computeConvolvedImage({
          apertureSettings,
          apertureDiameterMm,
          diagnosticWavelengthNm,
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
    diagnosticWavelengthNm,
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

  const wavefrontLegendUnitControl = (
    <Box>
      <Typography
        id="wavefront-legend-unit-button-group-label"
        variant="subtitle1"
        sx={{ mb: 1 }}
      >
        Legend Unit
      </Typography>
      <ButtonGroup aria-labelledby="wavefront-legend-unit-button-group-label" fullWidth>
        {wavefrontLegendUnitOptions.map((option) => (
          <Button
            key={option.value}
            aria-label={option.label}
            variant={wavefrontLegendUnit === option.value ? 'contained' : 'outlined'}
            onClick={() => {
              setWavefrontLegendUnit(option.value);
            }}
          >
            {option.label}
          </Button>
        ))}
      </ButtonGroup>
    </Box>
  );
  const simulatedImagePanel: AdvancedResultPanel = {
    id: 'simulated-image',
    imageUrl: result?.imageUrl,
    statusText: diagnostics.message,
    isLoading: isImageLoading,
    error,
    description: simulatedImageDescription,
    aboveAccordionContent: shouldMergeAdvancedResults ? undefined : approximateStrehlContent
  };
  const psfPanel: AdvancedResultPanel = {
    id: 'psf',
    imageUrl: result?.psfImageUrl,
    statusText: diagnostics.message,
    isLoading: isImageLoading,
    error,
    title: 'PSF',
    description: 'The rendered point spread function for the current optical system.',
    supplementalDescription: psfSupplementalDescription,
    altText: 'Rendered point spread function'
  };
  const wavefrontPanel: AdvancedResultPanel = {
    id: 'wavefront-map',
    imageUrl: result?.wavefrontImageUrl,
    statusText: diagnostics.message,
    isLoading: isImageLoading,
    error,
    title: 'Wavefront Map',
    description: 'The rendered wavefront map for the current Zernike aberration values.',
    altText: 'Rendered wavefront map',
    bottomContent: wavefrontLegendUnitControl
  };
  const advancedResultPanels =
    targetId === 'point_source'
      ? ([simulatedImagePanel, wavefrontPanel] as const)
      : ([simulatedImagePanel, psfPanel, wavefrontPanel] as const);

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
              gridTemplateColumns: '1fr'
            }}
          >
            {shouldMergeAdvancedResults ? (
              <Box
                sx={{
                  ...stickyImageCardMaskSx,
                  alignSelf: 'stretch',
                  position: 'sticky',
                  top: desktopStickyTopPx,
                  zIndex: 3
                }}
              >
                <AdvancedResultCard
                  panels={advancedResultPanels}
                  sharedAboveAccordionContent={approximateStrehlContent}
                />
              </Box>
            ) : (
              <>
                <Box
                  sx={{
                    ...stickyImageCardMaskSx,
                    alignSelf: { xs: 'start', sm: 'stretch' },
                    position: 'sticky',
                    top: { xs: mobileStickyTopPx, sm: desktopStickyTopPx },
                    zIndex: 3
                  }}
                >
                  <SimulatedImageCard {...simulatedImagePanel} />
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
                    <SimulatedImageCard {...psfPanel} />
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
                    <SimulatedImageCard {...wavefrontPanel} />
                  </Box>
                ) : undefined}
              </>
            )}
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
                    wavelengthNm={selectedWavelength}
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
                  wavelengthNm={550}
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
