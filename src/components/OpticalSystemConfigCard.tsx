import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Modal from '@mui/material/Modal';
import NativeSelect from '@mui/material/NativeSelect';
import Stack from '@mui/material/Stack';
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
  const shapeId = useId();
  const obstructionShapeId = useId();
  const [draftShape, setDraftShape] = useState<ApertureShape>(apertureSettings.shape);
  const [draftRotationDegrees, setDraftRotationDegrees] = useState(
    apertureSettings.rotationDegrees
  );
  const [draftObstructionRatio, setDraftObstructionRatio] = useState(
    apertureSettings.centralObstructionRatio
  );
  const [draftObstructionShape, setDraftObstructionShape] = useState<ApertureShape>(
    apertureSettings.centralObstructionShape
  );
  const [draftObstructionRotationDegrees, setDraftObstructionRotationDegrees] =
    useState(apertureSettings.centralObstructionRotationDegrees);
  const [preview, setPreview] = useState<ApertureMaskResult | undefined>(undefined);
  const [previewError, setPreviewError] = useState<string | undefined>(undefined);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const obstructionRatioIsValid =
    Number.isFinite(draftObstructionRatio) &&
    draftObstructionRatio >= 0 &&
    draftObstructionRatio < 1;
  const apertureRotationIsValid =
    draftShape === 'circle' ||
    (Number.isFinite(draftRotationDegrees) &&
      draftRotationDegrees >= 0 &&
      draftRotationDegrees <= 360);
  const obstructionRotationIsValid =
    !obstructionRatioIsValid ||
    draftObstructionRatio === 0 ||
    draftObstructionShape === 'circle' ||
    (Number.isFinite(draftObstructionRotationDegrees) &&
      draftObstructionRotationDegrees >= 0 &&
      draftObstructionRotationDegrees <= 360);
  const draftIsValid =
    obstructionRatioIsValid &&
    apertureRotationIsValid &&
    obstructionRotationIsValid;
  const draftSettings = useMemo<ApertureSettings | undefined>(
    () =>
      draftIsValid
        ? {
            shape: draftShape,
            rotationDegrees: draftShape === 'circle' ? 0 : draftRotationDegrees,
            centralObstructionShape:
              draftObstructionRatio > 0 ? draftObstructionShape : 'circle',
            centralObstructionRotationDegrees:
              draftObstructionRatio > 0 && draftObstructionShape !== 'circle'
                ? draftObstructionRotationDegrees
                : 0,
            centralObstructionRatio: draftObstructionRatio
          }
        : undefined,
    [
      draftIsValid,
      draftShape,
      draftRotationDegrees,
      draftObstructionShape,
      draftObstructionRotationDegrees,
      draftObstructionRatio
    ]
  );
  const showApertureRotation = draftShape !== 'circle';
  const showObstructionControls = draftIsValid && draftObstructionRatio > 0;
  const showObstructionRotation = showObstructionControls && draftObstructionShape !== 'circle';

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraftShape(apertureSettings.shape);
    setDraftRotationDegrees(apertureSettings.rotationDegrees);
    setDraftObstructionRatio(apertureSettings.centralObstructionRatio);
    setDraftObstructionShape(apertureSettings.centralObstructionShape);
    setDraftObstructionRotationDegrees(
      apertureSettings.centralObstructionRotationDegrees
    );
  }, [apertureSettings, open]);

  useEffect(() => {
    if (!open || !draftSettings) {
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
  }, [draftSettings, onRenderApertureMask, open]);

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
          borderRadius: 1,
          boxShadow: 24,
          left: '50%',
          maxHeight: 'calc(100vh - 48px)',
          maxWidth: 520,
          overflowY: 'auto',
          p: 3,
          position: 'absolute',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'calc(100% - 32px)'
        }}
      >
        <Stack spacing={2}>
          <Typography id={titleId} variant="h5" component="h2">
            Aperture Mask
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel htmlFor={shapeId}>Aperture Shape</InputLabel>
            <NativeSelect
              value={draftShape}
              onChange={(event) => {
                setDraftShape(event.target.value as ApertureShape);
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
              value={draftRotationDegrees}
              input={rotationSliderInput}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${value.toFixed(0)} deg`}
              roundValue={Math.round}
              onCommit={setDraftRotationDegrees}
            />
          ) : undefined}
          <CommitSlider
            ariaLabel="Central Obstruction Ratio"
            label="Central Obstruction Ratio"
            min={0}
            max={0.99}
            step={0.01}
            value={draftObstructionRatio}
            input={ratioSliderInput}
            valueLabelDisplay="auto"
            valueLabelFormat={formatRatioValue}
            roundValue={roundRatioValue}
            onCommit={setDraftObstructionRatio}
          />
          {showObstructionControls ? (
            <>
              <FormControl fullWidth size="small">
                <InputLabel htmlFor={obstructionShapeId}>Obstruction Shape</InputLabel>
                <NativeSelect
                  value={draftObstructionShape}
                  onChange={(event) => {
                    setDraftObstructionShape(event.target.value as ApertureShape);
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
              {showObstructionRotation ? (
                <CommitSlider
                  ariaLabel="Obstruction Rotation"
                  label="Obstruction Rotation"
                  min={0}
                  max={360}
                  step={1}
                  value={draftObstructionRotationDegrees}
                  input={rotationSliderInput}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${value.toFixed(0)} deg`}
                  roundValue={Math.round}
                  onCommit={setDraftObstructionRotationDegrees}
                />
              ) : undefined}
            </>
          ) : undefined}
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
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{ justifyContent: 'flex-end' }}
          >
            <Button
              aria-label="Cancel aperture mask"
              variant="outlined"
              onClick={onCancel}
            >
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
          </Stack>
        </Stack>
      </Box>
    </Modal>
  );
}

function formatApertureSummary(settings: ApertureSettings): string {
  const obstructionPercent = settings.centralObstructionRatio * 100;
  const obstructionLabel =
    settings.centralObstructionRatio > 0
      ? ` ${formatShapeLabel(settings.centralObstructionShape).toLowerCase()}`
      : '';
  return `${formatShapeLabel(settings.shape)}, ${obstructionPercent.toLocaleString(undefined, {
    maximumFractionDigits: 1
  })}%${obstructionLabel} obstruction`;
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
