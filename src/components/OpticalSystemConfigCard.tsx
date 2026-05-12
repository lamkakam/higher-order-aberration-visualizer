import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import Modal from '@mui/material/Modal';
import NativeSelect from '@mui/material/NativeSelect';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import type { ChangeEvent } from 'react';
import { useEffect, useId, useMemo, useState } from 'react';
import type {
  ApertureMaskResult,
  ApertureSettings,
  ApertureShape,
  SupportedTargetId
} from '../workers/types';
import type { DisplayMode } from './SettingsDrawer';
import { CommitSlider } from './CommitSlider';
import { NumberField } from './NumberField';
import { targetOptions } from './simulationConfig';

const apertureShapeOptions = [
  { value: 'circle', label: 'Circle' },
  { value: 'square', label: 'Square' },
  { value: 'regular_hexagon', label: 'Regular Hexagon' }
] as const satisfies readonly {
  readonly value: ApertureShape;
  readonly label: string;
}[];

const rotationSliderInput = {
  formatValue: (value: number) => String(Math.round(value)),
  parseDraft: (draft: string) => Number(draft),
  isDraftAllowed: (draft: string) => draft === '' || /^\d*$/.test(draft),
  isValidDraft: (draft: string, parsedValue: number) =>
    draft.trim() !== '' &&
    Number.isFinite(parsedValue) &&
    parsedValue >= 0 &&
    parsedValue <= 360,
  getErrorText: (draft: string, parsedValue: number) =>
    draft.trim() !== '' &&
    Number.isFinite(parsedValue) &&
    (parsedValue < 0 || parsedValue > 360)
      ? 'Value must be between 0 and 360.'
      : undefined,
  inputMode: 'numeric' as const,
  inputMin: 0,
  inputMax: 360,
  inputStep: 1
};

const ratioSliderInput = {
  formatValue: formatRatioValue,
  parseDraft: (draft: string) => Number(draft),
  isDraftAllowed: isRatioText,
  isValidDraft: (draft: string, parsedValue: number) =>
    draft.trim() !== '' &&
    Number.isFinite(parsedValue) &&
    parsedValue >= 0 &&
    parsedValue < 1,
  getErrorText: (draft: string, parsedValue: number) =>
    draft.trim() !== '' &&
    Number.isFinite(parsedValue) &&
    (parsedValue < 0 || parsedValue >= 1)
      ? 'Value must be at least 0 and less than 1.'
      : undefined,
  inputMode: 'decimal' as const,
  inputMin: 0,
  inputMax: 0.999,
  inputStep: 0.01
};

const gaussianSigmaRatioSliderInput = {
  formatValue: formatRatioValue,
  parseDraft: (draft: string) => Number(draft),
  isDraftAllowed: isRatioText,
  isValidDraft: (draft: string, parsedValue: number) =>
    draft.trim() !== '' &&
    Number.isFinite(parsedValue) &&
    parsedValue >= 0.05 &&
    parsedValue <= 1,
  getErrorText: (draft: string, parsedValue: number) =>
    draft.trim() !== '' &&
    Number.isFinite(parsedValue) &&
    (parsedValue < 0.05 || parsedValue > 1)
      ? 'Value must be between 0.05 and 1.'
      : undefined,
  inputMode: 'decimal' as const,
  inputMin: 0.05,
  inputMax: 1,
  inputStep: 0.01
};

const spiderVaneCountSliderInput = {
  formatValue: (value: number) => String(Math.round(value)),
  parseDraft: (draft: string) => Number(draft),
  isDraftAllowed: (draft: string) => draft === '' || /^\d*$/.test(draft),
  isValidDraft: (draft: string, parsedValue: number) =>
    draft.trim() !== '' &&
    Number.isFinite(parsedValue) &&
    Number.isInteger(parsedValue) &&
    parsedValue >= 0 &&
    parsedValue <= 12,
  getErrorText: (draft: string, parsedValue: number) =>
    draft.trim() !== '' &&
    Number.isFinite(parsedValue) &&
    (parsedValue < 0 || parsedValue > 12)
      ? 'Value must be between 0 and 12.'
      : undefined,
  inputMode: 'numeric' as const,
  inputMin: 0,
  inputMax: 12,
  inputStep: 1
};

const spiderVaneWidthRatioSliderInput = {
  formatValue: formatRatioValue,
  parseDraft: (draft: string) => Number(draft),
  isDraftAllowed: isRatioText,
  isValidDraft: (draft: string, parsedValue: number) =>
    draft.trim() !== '' &&
    Number.isFinite(parsedValue) &&
    parsedValue >= 0 &&
    parsedValue <= 0.25,
  getErrorText: (draft: string, parsedValue: number) =>
    draft.trim() !== '' &&
    Number.isFinite(parsedValue) &&
    (parsedValue < 0 || parsedValue > 0.25)
      ? 'Value must be between 0 and 0.25.'
      : undefined,
  inputMode: 'decimal' as const,
  inputMin: 0,
  inputMax: 0.25,
  inputStep: 0.01
};

interface OpticalSystemConfigCardProps {
  readonly apertureDiameterMm: number;
  readonly apertureSettings: ApertureSettings;
  readonly displayMode: DisplayMode;
  readonly targetId: SupportedTargetId;
  readonly onApertureChange: (value: number) => void;
  readonly onApertureSettingsChange: (value: ApertureSettings) => void;
  readonly onRenderApertureMask: (value: ApertureSettings) => Promise<ApertureMaskResult>;
  readonly onTargetChange: (value: SupportedTargetId) => void;
}

export function OpticalSystemConfigCard({
  apertureDiameterMm,
  apertureSettings,
  displayMode,
  targetId,
  onApertureChange,
  onApertureSettingsChange,
  onRenderApertureMask,
  onTargetChange
}: OpticalSystemConfigCardProps) {
  const apertureHasError = !Number.isFinite(apertureDiameterMm) || apertureDiameterMm < 0.5;
  const [isApertureModalOpen, setIsApertureModalOpen] = useState(false);

  function handleTargetChange(event: ChangeEvent<HTMLSelectElement>) {
    onTargetChange(event.target.value as SupportedTargetId);
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h5" component="h2">
            Optical System Config
          </Typography>
          <NumberField
            label="Aperture Diameter (mm)"
            min={0.5}
            error={apertureHasError}
            value={apertureDiameterMm}
            onChange={onApertureChange}
          />
          <FormControl fullWidth size="small">
            <InputLabel htmlFor="target-select">Target</InputLabel>
            <NativeSelect
              value={targetId}
              onChange={handleTargetChange}
              inputProps={{
                id: 'target-select',
                'aria-label': 'Target'
              }}
            >
              {targetOptions.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.label}
                </option>
              ))}
            </NativeSelect>
          </FormControl>
          {displayMode === 'advanced' ? (
            <Stack spacing={1}>
              <Typography variant="subtitle2" component="p">
                Aperture Mask
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatApertureSummary(apertureSettings)}
              </Typography>
              <Button
                aria-label="Edit aperture mask"
                variant="outlined"
                onClick={() => {
                  setIsApertureModalOpen(true);
                }}
              >
                Edit
              </Button>
            </Stack>
          ) : undefined}
        </Stack>
      </CardContent>
      <ApertureMaskModal
        open={isApertureModalOpen}
        apertureSettings={apertureSettings}
        onCancel={() => {
          setIsApertureModalOpen(false);
        }}
        onConfirm={(nextSettings) => {
          onApertureSettingsChange(nextSettings);
          setIsApertureModalOpen(false);
        }}
        onRenderApertureMask={onRenderApertureMask}
      />
    </Card>
  );
}

interface ApertureMaskModalProps {
  readonly open: boolean;
  readonly apertureSettings: ApertureSettings;
  readonly onCancel: () => void;
  readonly onConfirm: (value: ApertureSettings) => void;
  readonly onRenderApertureMask: (value: ApertureSettings) => Promise<ApertureMaskResult>;
}

function ApertureMaskModal({
  open,
  apertureSettings,
  onCancel,
  onConfirm,
  onRenderApertureMask
}: ApertureMaskModalProps) {
  const titleId = useId();

  return (
    <Modal
      open={open}
      aria-labelledby={titleId}
      onClose={() => {}}
    >
      <Box
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        sx={{
          bgcolor: 'background.paper',
          borderRadius: { xs: 0, sm: 1 },
          boxShadow: 24,
          display: 'flex',
          flexDirection: 'column',
          height: { xs: '100vh', sm: 'auto' },
          left: { xs: 0, sm: '50%' },
          maxHeight: { xs: '100vh', sm: 'calc(100vh - 48px)' },
          maxWidth: { xs: 'none', sm: 520 },
          overflow: 'hidden',
          p: { xs: 2, sm: 3 },
          position: 'absolute',
          top: { xs: 0, sm: '50%' },
          transform: { xs: 'none', sm: 'translate(-50%, -50%)' },
          width: { xs: '100%', sm: 'calc(100% - 32px)' },
          '@supports (height: 100dvh)': {
            height: { xs: '100dvh', sm: 'auto' },
            maxHeight: { xs: '100dvh', sm: 'calc(100dvh - 48px)' }
          }
        }}
      >
        <Typography id={titleId} variant="h5" component="h2" sx={{ flexShrink: 0 }}>
          Aperture Mask
        </Typography>
        {open ? (
          <ApertureMaskModalDraft
            key={getApertureMaskModalDraftKey(apertureSettings)}
            apertureSettings={apertureSettings}
            onCancel={onCancel}
            onConfirm={onConfirm}
            onRenderApertureMask={onRenderApertureMask}
          />
        ) : undefined}
      </Box>
    </Modal>
  );
}

interface ApertureMaskModalDraftProps {
  readonly apertureSettings: ApertureSettings;
  readonly onCancel: () => void;
  readonly onConfirm: (value: ApertureSettings) => void;
  readonly onRenderApertureMask: (value: ApertureSettings) => Promise<ApertureMaskResult>;
}

function ApertureMaskModalDraft({
  apertureSettings,
  onCancel,
  onConfirm,
  onRenderApertureMask
}: ApertureMaskModalDraftProps) {
  const shapeId = useId();
  const obstructionShapeId = useId();
  const draft = useApertureMaskDraft(apertureSettings);
  const draftSettings = useMemo(() => normalizeApertureMaskDraft(draft.state), [draft.state]);
  const visibility = getApertureMaskVisibility(draft.state, draftSettings);

  return (
    <>
      <ApertureMaskModalContent
        shapeId={shapeId}
        obstructionShapeId={obstructionShapeId}
        draft={draft}
        visibility={visibility}
        draftSettings={draftSettings}
        onRenderApertureMask={onRenderApertureMask}
      />
      <ApertureMaskModalFooter
        draftSettings={draftSettings}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    </>
  );
}

interface ApertureMaskDraftState {
  readonly shape: ApertureShape;
  readonly rotationDegrees: number;
  readonly centralObstructionRatio: number;
  readonly centralObstructionShape: ApertureShape;
  readonly centralObstructionRotationDegrees: number;
  readonly gaussianApodizationEnabled: boolean;
  readonly gaussianApodizationSigmaRatio: number;
  readonly spiderVaneCount: number;
  readonly spiderVaneWidthRatio: number;
  readonly spiderVaneRotationDegrees: number;
}

interface ApertureMaskDraftActions {
  readonly setShape: (value: ApertureShape) => void;
  readonly setRotationDegrees: (value: number) => void;
  readonly setCentralObstructionRatio: (value: number) => void;
  readonly setCentralObstructionShape: (value: ApertureShape) => void;
  readonly setCentralObstructionRotationDegrees: (value: number) => void;
  readonly setGaussianApodizationEnabled: (value: boolean) => void;
  readonly setGaussianApodizationSigmaRatio: (value: number) => void;
  readonly setSpiderVaneCount: (value: number) => void;
  readonly setSpiderVaneWidthRatio: (value: number) => void;
  readonly setSpiderVaneRotationDegrees: (value: number) => void;
}

interface ApertureMaskDraft {
  readonly state: ApertureMaskDraftState;
  readonly actions: ApertureMaskDraftActions;
}

function useApertureMaskDraft(apertureSettings: ApertureSettings): ApertureMaskDraft {
  const [shape, setShape] = useState<ApertureShape>(apertureSettings.shape);
  const [rotationDegrees, setRotationDegrees] = useState(apertureSettings.rotationDegrees);
  const [centralObstructionRatio, setCentralObstructionRatio] = useState(
    apertureSettings.centralObstructionRatio
  );
  const [centralObstructionShape, setCentralObstructionShape] = useState<ApertureShape>(
    apertureSettings.centralObstructionShape
  );
  const [centralObstructionRotationDegrees, setCentralObstructionRotationDegrees] =
    useState(apertureSettings.centralObstructionRotationDegrees);
  const [gaussianApodizationEnabled, setGaussianApodizationEnabled] = useState(
    apertureSettings.gaussianApodizationEnabled
  );
  const [gaussianApodizationSigmaRatio, setGaussianApodizationSigmaRatio] = useState(
    apertureSettings.gaussianApodizationSigmaRatio
  );
  const [spiderVaneCount, setSpiderVaneCount] = useState(apertureSettings.spiderVaneCount);
  const [spiderVaneWidthRatio, setSpiderVaneWidthRatio] = useState(
    apertureSettings.spiderVaneWidthRatio
  );
  const [spiderVaneRotationDegrees, setSpiderVaneRotationDegrees] = useState(
    apertureSettings.spiderVaneRotationDegrees
  );

  const state = useMemo(
    () => ({
      shape,
      rotationDegrees,
      centralObstructionRatio,
      centralObstructionShape,
      centralObstructionRotationDegrees,
      gaussianApodizationEnabled,
      gaussianApodizationSigmaRatio,
      spiderVaneCount,
      spiderVaneWidthRatio,
      spiderVaneRotationDegrees
    }),
    [
      shape,
      rotationDegrees,
      centralObstructionRatio,
      centralObstructionShape,
      centralObstructionRotationDegrees,
      gaussianApodizationEnabled,
      gaussianApodizationSigmaRatio,
      spiderVaneCount,
      spiderVaneWidthRatio,
      spiderVaneRotationDegrees
    ]
  );
  const actions = useMemo(
    () => ({
      setShape,
      setRotationDegrees,
      setCentralObstructionRatio,
      setCentralObstructionShape,
      setCentralObstructionRotationDegrees,
      setGaussianApodizationEnabled,
      setGaussianApodizationSigmaRatio,
      setSpiderVaneCount,
      setSpiderVaneWidthRatio,
      setSpiderVaneRotationDegrees
    }),
    []
  );

  return { state, actions };
}

interface ApertureMaskVisibility {
  readonly showApertureRotation: boolean;
  readonly showObstructionControls: boolean;
  readonly showObstructionRotation: boolean;
  readonly showGaussianSigma: boolean;
}

interface ApertureMaskModalContentProps {
  readonly shapeId: string;
  readonly obstructionShapeId: string;
  readonly draft: ApertureMaskDraft;
  readonly visibility: ApertureMaskVisibility;
  readonly draftSettings: ApertureSettings | undefined;
  readonly onRenderApertureMask: (value: ApertureSettings) => Promise<ApertureMaskResult>;
}

function ApertureMaskModalContent({
  shapeId,
  obstructionShapeId,
  draft,
  visibility,
  draftSettings,
  onRenderApertureMask
}: ApertureMaskModalContentProps) {
  return (
    <Box
      data-testid="aperture-mask-modal-content"
      style={{
        marginLeft: -16,
        marginRight: -8,
        minHeight: 0,
        overflowY: 'auto',
        paddingLeft: 16,
        paddingRight: 20,
        scrollbarGutter: 'stable'
      }}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        py: 2
      }}
    >
      <ApertureShapeControls
        shapeId={shapeId}
        state={draft.state}
        actions={draft.actions}
        showApertureRotation={visibility.showApertureRotation}
      />
      <CentralObstructionControls
        obstructionShapeId={obstructionShapeId}
        state={draft.state}
        actions={draft.actions}
        visibility={visibility}
      />
      <SpiderVaneControls state={draft.state} actions={draft.actions} />
      <GaussianApodizationControls
        state={draft.state}
        actions={draft.actions}
        showGaussianSigma={visibility.showGaussianSigma}
      />
      <ApertureMaskPreviewPanel
        draftSettings={draftSettings}
        onRenderApertureMask={onRenderApertureMask}
      />
    </Box>
  );
}

interface ApertureShapeControlsProps {
  readonly shapeId: string;
  readonly state: ApertureMaskDraftState;
  readonly actions: ApertureMaskDraftActions;
  readonly showApertureRotation: boolean;
}

function ApertureShapeControls({
  shapeId,
  state,
  actions,
  showApertureRotation
}: ApertureShapeControlsProps) {
  return (
    <>
      <FormControl fullWidth size="small">
        <InputLabel htmlFor={shapeId}>Aperture Shape</InputLabel>
        <NativeSelect
          value={state.shape}
          onChange={(event) => {
            actions.setShape(event.target.value as ApertureShape);
          }}
          inputProps={{
            id: shapeId,
            'aria-label': 'Aperture Shape'
          }}
        >
          {apertureShapeOptions.map((shape) => (
            <option key={shape.value} value={shape.value}>
              {shape.label}
            </option>
          ))}
        </NativeSelect>
      </FormControl>
      {showApertureRotation ? (
        <CommitSlider
          ariaLabel="Aperture Rotation"
          label="Aperture Rotation"
          min={0}
          max={360}
          step={1}
          value={state.rotationDegrees}
          input={rotationSliderInput}
          valueLabelDisplay="auto"
          valueLabelFormat={(value) => `${value.toFixed(0)} deg`}
          roundValue={Math.round}
          onCommit={actions.setRotationDegrees}
        />
      ) : undefined}
    </>
  );
}

interface CentralObstructionControlsProps {
  readonly obstructionShapeId: string;
  readonly state: ApertureMaskDraftState;
  readonly actions: ApertureMaskDraftActions;
  readonly visibility: ApertureMaskVisibility;
}

function CentralObstructionControls({
  obstructionShapeId,
  state,
  actions,
  visibility
}: CentralObstructionControlsProps) {
  return (
    <>
      <CommitSlider
        ariaLabel="Central Obstruction Ratio"
        label="Central Obstruction Ratio"
        min={0}
        max={0.99}
        step={0.01}
        value={state.centralObstructionRatio}
        input={ratioSliderInput}
        valueLabelDisplay="auto"
        valueLabelFormat={formatRatioValue}
        roundValue={roundRatioValue}
        onCommit={actions.setCentralObstructionRatio}
      />
      {visibility.showObstructionControls ? (
        <>
          <FormControl fullWidth size="small">
            <InputLabel htmlFor={obstructionShapeId}>Obstruction Shape</InputLabel>
            <NativeSelect
              value={state.centralObstructionShape}
              onChange={(event) => {
                actions.setCentralObstructionShape(event.target.value as ApertureShape);
              }}
              inputProps={{
                id: obstructionShapeId,
                'aria-label': 'Obstruction Shape'
              }}
            >
              {apertureShapeOptions.map((shape) => (
                <option key={shape.value} value={shape.value}>
                  {shape.label}
                </option>
              ))}
            </NativeSelect>
          </FormControl>
          {visibility.showObstructionRotation ? (
            <CommitSlider
              ariaLabel="Obstruction Rotation"
              label="Obstruction Rotation"
              min={0}
              max={360}
              step={1}
              value={state.centralObstructionRotationDegrees}
              input={rotationSliderInput}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${value.toFixed(0)} deg`}
              roundValue={Math.round}
              onCommit={actions.setCentralObstructionRotationDegrees}
            />
          ) : undefined}
        </>
      ) : undefined}
    </>
  );
}

interface SpiderVaneControlsProps {
  readonly state: ApertureMaskDraftState;
  readonly actions: ApertureMaskDraftActions;
}

function SpiderVaneControls({ state, actions }: SpiderVaneControlsProps) {
  return (
    <>
      <CommitSlider
        ariaLabel="Spider Vanes"
        label="Spider Vanes"
        min={0}
        max={12}
        step={1}
        value={state.spiderVaneCount}
        input={spiderVaneCountSliderInput}
        valueLabelDisplay="auto"
        valueLabelFormat={(value) => value.toFixed(0)}
        roundValue={Math.round}
        onCommit={actions.setSpiderVaneCount}
      />
      <CommitSlider
        ariaLabel="Vane Width (x Aperture Diameter)"
        label="Vane Width (x Aperture Diameter)"
        min={0}
        max={0.25}
        step={0.01}
        value={state.spiderVaneWidthRatio}
        input={spiderVaneWidthRatioSliderInput}
        valueLabelDisplay="auto"
        valueLabelFormat={(value) => `${formatRatioValue(value)}D`}
        roundValue={roundRatioValue}
        onCommit={actions.setSpiderVaneWidthRatio}
      />
      <CommitSlider
        ariaLabel="Vane Rotation"
        label="Vane Rotation"
        min={0}
        max={360}
        step={1}
        value={state.spiderVaneRotationDegrees}
        input={rotationSliderInput}
        valueLabelDisplay="auto"
        valueLabelFormat={(value) => `${value.toFixed(0)} deg`}
        roundValue={Math.round}
        onCommit={actions.setSpiderVaneRotationDegrees}
      />
    </>
  );
}

interface GaussianApodizationControlsProps {
  readonly state: ApertureMaskDraftState;
  readonly actions: ApertureMaskDraftActions;
  readonly showGaussianSigma: boolean;
}

function GaussianApodizationControls({
  state,
  actions,
  showGaussianSigma
}: GaussianApodizationControlsProps) {
  return (
    <>
      <FormControlLabel
        control={
          <Switch
            checked={state.gaussianApodizationEnabled}
            onChange={(event) => {
              actions.setGaussianApodizationEnabled(event.target.checked);
            }}
          />
        }
        label="Gaussian Apodization"
      />
      {showGaussianSigma ? (
        <CommitSlider
          ariaLabel="Standard Deviation (x Aperture Diameter)"
          label="Standard Deviation (x Aperture Diameter)"
          min={0.05}
          max={1}
          step={0.01}
          value={state.gaussianApodizationSigmaRatio}
          input={gaussianSigmaRatioSliderInput}
          valueLabelDisplay="auto"
          valueLabelFormat={(value) => `${formatRatioValue(value)}D`}
          roundValue={roundRatioValue}
          onCommit={actions.setGaussianApodizationSigmaRatio}
        />
      ) : undefined}
    </>
  );
}

interface ApertureMaskPreviewPanelProps {
  readonly draftSettings: ApertureSettings | undefined;
  readonly onRenderApertureMask: (value: ApertureSettings) => Promise<ApertureMaskResult>;
}

function ApertureMaskPreviewPanel({
  draftSettings,
  onRenderApertureMask
}: ApertureMaskPreviewPanelProps) {
  const [preview, setPreview] = useState<ApertureMaskResult | undefined>(undefined);
  const [previewError, setPreviewError] = useState<string | undefined>(undefined);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  useEffect(() => {
    if (!draftSettings) {
      return;
    }

    let cancelled = false;
    setIsPreviewLoading(true);
    setPreviewError(undefined);
    onRenderApertureMask(draftSettings)
      .then((nextPreview) => {
        if (!cancelled) {
          setPreview(nextPreview);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setPreview(undefined);
          setPreviewError(error instanceof Error ? error.message : 'Aperture preview failed');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [draftSettings, onRenderApertureMask]);

  return (
    <>
      <Typography variant="subtitle2" component="p">
        Preview
      </Typography>
      <Box
        data-testid="aperture-mask-preview-panel"
        sx={{
          alignItems: 'center',
          bgcolor: 'background.default',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          display: 'flex',
          height: 280,
          justifyContent: 'center',
          minHeight: 280,
          overflow: 'hidden',
          p: 2
        }}
      >
        {isPreviewLoading ? (
          <Typography variant="body2">Preparing aperture mask...</Typography>
        ) : previewError ? (
          <Typography variant="body2" color="error">
            {previewError}
          </Typography>
        ) : preview ? (
          <Box
            component="img"
            src={preview.imageUrl}
            alt="Aperture mask preview"
            sx={{
              display: 'block',
              height: 'auto',
              maxHeight: 260,
              maxWidth: '100%',
              objectFit: 'contain'
            }}
          />
        ) : (
          <Typography variant="body2">Preparing aperture mask...</Typography>
        )}
      </Box>
    </>
  );
}

interface ApertureMaskModalFooterProps {
  readonly draftSettings: ApertureSettings | undefined;
  readonly onCancel: () => void;
  readonly onConfirm: (value: ApertureSettings) => void;
}

function ApertureMaskModalFooter({
  draftSettings,
  onCancel,
  onConfirm
}: ApertureMaskModalFooterProps) {
  return (
    <Box
      data-testid="aperture-mask-modal-footer"
      style={{ flexShrink: 0 }}
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        gap: 1,
        justifyContent: 'flex-end',
        pt: 2
      }}
    >
      <Button aria-label="Cancel aperture mask" variant="outlined" onClick={onCancel}>
        Cancel
      </Button>
      <Button
        aria-label="Confirm aperture mask"
        variant="contained"
        disabled={!draftSettings}
        onClick={() => {
          if (draftSettings) {
            onConfirm(draftSettings);
          }
        }}
      >
        Confirm
      </Button>
    </Box>
  );
}

function getApertureMaskModalDraftKey(settings: ApertureSettings): string {
  return [
    settings.shape,
    settings.rotationDegrees,
    settings.centralObstructionRatio,
    settings.centralObstructionShape,
    settings.centralObstructionRotationDegrees,
    settings.gaussianApodizationEnabled,
    settings.gaussianApodizationSigmaRatio,
    settings.spiderVaneCount,
    settings.spiderVaneWidthRatio,
    settings.spiderVaneRotationDegrees
  ].join('|');
}

function getApertureMaskVisibility(
  draft: ApertureMaskDraftState,
  normalizedDraft: ApertureSettings | undefined
): ApertureMaskVisibility {
  const showObstructionControls =
    normalizedDraft !== undefined && draft.centralObstructionRatio > 0;

  return {
    showApertureRotation: draft.shape !== 'circle',
    showObstructionControls,
    showObstructionRotation:
      showObstructionControls && draft.centralObstructionShape !== 'circle',
    showGaussianSigma: draft.gaussianApodizationEnabled
  };
}

function normalizeApertureMaskDraft(
  draft: ApertureMaskDraftState
): ApertureSettings | undefined {
  if (!isApertureMaskDraftValid(draft)) {
    return undefined;
  }

  return {
    shape: draft.shape,
    rotationDegrees: draft.shape === 'circle' ? 0 : draft.rotationDegrees,
    centralObstructionShape:
      draft.centralObstructionRatio > 0 ? draft.centralObstructionShape : 'circle',
    centralObstructionRotationDegrees:
      draft.centralObstructionRatio > 0 && draft.centralObstructionShape !== 'circle'
        ? draft.centralObstructionRotationDegrees
        : 0,
    centralObstructionRatio: draft.centralObstructionRatio,
    spiderVaneCount: draft.spiderVaneCount,
    spiderVaneWidthRatio: draft.spiderVaneWidthRatio,
    spiderVaneRotationDegrees: draft.spiderVaneRotationDegrees,
    gaussianApodizationEnabled: draft.gaussianApodizationEnabled,
    gaussianApodizationSigmaRatio: draft.gaussianApodizationSigmaRatio
  };
}

function isApertureMaskDraftValid(draft: ApertureMaskDraftState): boolean {
  return (
    isApertureRotationValid(draft) &&
    isObstructionRatioValid(draft.centralObstructionRatio) &&
    isObstructionRotationValid(draft) &&
    isSpiderVaneCountValid(draft.spiderVaneCount) &&
    isSpiderVaneWidthRatioValid(draft.spiderVaneWidthRatio) &&
    isRotationDegreesValid(draft.spiderVaneRotationDegrees) &&
    isGaussianSigmaRatioValid(draft)
  );
}

function isApertureRotationValid(draft: ApertureMaskDraftState): boolean {
  return draft.shape === 'circle' || isRotationDegreesValid(draft.rotationDegrees);
}

function isObstructionRatioValid(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value < 1;
}

function isObstructionRotationValid(draft: ApertureMaskDraftState): boolean {
  return (
    !isObstructionRatioValid(draft.centralObstructionRatio) ||
    draft.centralObstructionRatio === 0 ||
    draft.centralObstructionShape === 'circle' ||
    isRotationDegreesValid(draft.centralObstructionRotationDegrees)
  );
}

function isSpiderVaneCountValid(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value >= 0 && value <= 12;
}

function isSpiderVaneWidthRatioValid(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 0.25;
}

function isGaussianSigmaRatioValid(draft: ApertureMaskDraftState): boolean {
  return (
    !draft.gaussianApodizationEnabled ||
    (Number.isFinite(draft.gaussianApodizationSigmaRatio) &&
      draft.gaussianApodizationSigmaRatio >= 0.05 &&
      draft.gaussianApodizationSigmaRatio <= 1)
  );
}

function isRotationDegreesValid(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 360;
}

function formatApertureSummary(settings: ApertureSettings): string {
  const obstructionPercent = settings.centralObstructionRatio * 100;
  const obstructionLabel =
    settings.centralObstructionRatio > 0
      ? ` ${formatShapeLabel(settings.centralObstructionShape).toLowerCase()}`
      : '';
  const maskSummary = `${formatShapeLabel(settings.shape)}, ${obstructionPercent.toLocaleString(undefined, {
    maximumFractionDigits: 1
  })}%${obstructionLabel} obstruction`;
  const effects = [maskSummary];
  if (settings.spiderVaneCount > 0 && settings.spiderVaneWidthRatio > 0) {
    effects.push(
      `${settings.spiderVaneCount}-vane spider rotated ${Math.round(
        settings.spiderVaneRotationDegrees
      )} deg, each vane ${formatRatioValue(
        settings.spiderVaneWidthRatio
      )}D wide`
    );
  }
  if (!settings.gaussianApodizationEnabled) {
    return effects.join(', ');
  }

  effects.push(
    `Gaussian apodization with ${formatRatioValue(
      settings.gaussianApodizationSigmaRatio
    )}D sigma`
  );
  return effects.join(', ');
}

function isRatioText(value: string) {
  return value === '' || /^(?:\d+\.?\d*|\.\d+)$/.test(value);
}

function roundRatioValue(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatRatioValue(value: number): string {
  const roundedValue = roundRatioValue(value);
  if (roundedValue === 0) {
    return '0';
  }

  return roundedValue.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function formatShapeLabel(shape: ApertureShape): string {
  return apertureShapeOptions.find((option) => option.value === shape)?.label ?? shape;
}
