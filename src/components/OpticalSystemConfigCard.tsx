import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import Modal from '@mui/material/Modal';
import NativeSelect from '@mui/material/NativeSelect';
import OutlinedInput from '@mui/material/OutlinedInput';
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
  { value: 'regular_hexagon', label: 'Regular Hexagon' },
  { value: 'ellipse', label: 'Ellipse' }
] as const satisfies readonly {
  readonly value: ApertureShape;
  readonly label: string;
}[];

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
  const rotationId = useId();
  const ellipseRatioId = useId();
  const obstructionId = useId();
  const obstructionShapeId = useId();
  const obstructionRotationId = useId();
  const obstructionEllipseRatioId = useId();
  const [draftShape, setDraftShape] = useState<ApertureShape>(apertureSettings.shape);
  const [draftRotationDegrees, setDraftRotationDegrees] = useState(
    apertureSettings.rotationDegrees
  );
  const [draftEllipseMinorAxisRatio, setDraftEllipseMinorAxisRatio] = useState(
    String(apertureSettings.ellipseMinorAxisRatio)
  );
  const [draftObstructionRatio, setDraftObstructionRatio] = useState(
    String(apertureSettings.centralObstructionRatio)
  );
  const [draftObstructionShape, setDraftObstructionShape] = useState<ApertureShape>(
    apertureSettings.centralObstructionShape
  );
  const [draftObstructionRotationDegrees, setDraftObstructionRotationDegrees] =
    useState(apertureSettings.centralObstructionRotationDegrees);
  const [draftObstructionEllipseMinorAxisRatio, setDraftObstructionEllipseMinorAxisRatio] =
    useState(String(apertureSettings.centralObstructionEllipseMinorAxisRatio));
  const [preview, setPreview] = useState<ApertureMaskResult | undefined>(undefined);
  const [previewError, setPreviewError] = useState<string | undefined>(undefined);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const parsedObstructionRatio = Number(draftObstructionRatio);
  const parsedEllipseMinorAxisRatio = Number(draftEllipseMinorAxisRatio);
  const parsedObstructionEllipseMinorAxisRatio = Number(
    draftObstructionEllipseMinorAxisRatio
  );
  const obstructionRatioIsValid =
    draftObstructionRatio.trim() !== '' &&
    Number.isFinite(parsedObstructionRatio) &&
    parsedObstructionRatio >= 0 &&
    parsedObstructionRatio < 1;
  const apertureRotationIsValid =
    draftShape === 'circle' ||
    (Number.isFinite(draftRotationDegrees) &&
      draftRotationDegrees >= 0 &&
      draftRotationDegrees <= 360);
  const apertureEllipseRatioIsValid =
    draftShape !== 'ellipse' ||
    (draftEllipseMinorAxisRatio.trim() !== '' &&
      Number.isFinite(parsedEllipseMinorAxisRatio) &&
      parsedEllipseMinorAxisRatio > 0 &&
      parsedEllipseMinorAxisRatio <= 1);
  const obstructionRotationIsValid =
    !obstructionRatioIsValid ||
    parsedObstructionRatio === 0 ||
    draftObstructionShape === 'circle' ||
    (Number.isFinite(draftObstructionRotationDegrees) &&
      draftObstructionRotationDegrees >= 0 &&
      draftObstructionRotationDegrees <= 360);
  const obstructionEllipseRatioIsValid =
    !obstructionRatioIsValid ||
    parsedObstructionRatio === 0 ||
    draftObstructionShape !== 'ellipse' ||
    (draftObstructionEllipseMinorAxisRatio.trim() !== '' &&
      Number.isFinite(parsedObstructionEllipseMinorAxisRatio) &&
      parsedObstructionEllipseMinorAxisRatio > 0 &&
      parsedObstructionEllipseMinorAxisRatio <= 1);
  const draftIsValid =
    obstructionRatioIsValid &&
    apertureRotationIsValid &&
    apertureEllipseRatioIsValid &&
    obstructionRotationIsValid &&
    obstructionEllipseRatioIsValid;
  const draftSettings = useMemo<ApertureSettings | undefined>(
    () =>
      draftIsValid
        ? {
            shape: draftShape,
            rotationDegrees: draftShape === 'circle' ? 0 : draftRotationDegrees,
            ellipseMinorAxisRatio: draftShape === 'ellipse' ? parsedEllipseMinorAxisRatio : 1,
            centralObstructionShape:
              parsedObstructionRatio > 0 ? draftObstructionShape : 'circle',
            centralObstructionRotationDegrees:
              parsedObstructionRatio > 0 && draftObstructionShape !== 'circle'
                ? draftObstructionRotationDegrees
                : 0,
            centralObstructionEllipseMinorAxisRatio:
              parsedObstructionRatio > 0 && draftObstructionShape === 'ellipse'
                ? parsedObstructionEllipseMinorAxisRatio
                : 1,
            centralObstructionRatio: parsedObstructionRatio
          }
        : undefined,
    [
      draftIsValid,
      draftShape,
      draftRotationDegrees,
      parsedEllipseMinorAxisRatio,
      draftObstructionShape,
      draftObstructionRotationDegrees,
      parsedObstructionEllipseMinorAxisRatio,
      parsedObstructionRatio
    ]
  );
  const showApertureRotation = draftShape !== 'circle';
  const showApertureEllipseRatio = draftShape === 'ellipse';
  const showObstructionControls = draftIsValid && parsedObstructionRatio > 0;
  const showObstructionRotation = showObstructionControls && draftObstructionShape !== 'circle';
  const showObstructionEllipseRatio =
    showObstructionControls && draftObstructionShape === 'ellipse';

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraftShape(apertureSettings.shape);
    setDraftRotationDegrees(apertureSettings.rotationDegrees);
    setDraftEllipseMinorAxisRatio(String(apertureSettings.ellipseMinorAxisRatio));
    setDraftObstructionRatio(String(apertureSettings.centralObstructionRatio));
    setDraftObstructionShape(apertureSettings.centralObstructionShape);
    setDraftObstructionRotationDegrees(
      apertureSettings.centralObstructionRotationDegrees
    );
    setDraftObstructionEllipseMinorAxisRatio(
      String(apertureSettings.centralObstructionEllipseMinorAxisRatio)
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
            <Stack spacing={1}>
              <Typography id={rotationId} variant="body2">
                Aperture Rotation
              </Typography>
              <CommitSlider
                ariaLabel="Aperture Rotation"
                min={0}
                max={360}
                step={1}
                value={draftRotationDegrees}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value.toFixed(0)} deg`}
                roundValue={Math.round}
                onPreview={setDraftRotationDegrees}
                onCommit={setDraftRotationDegrees}
              />
            </Stack>
          ) : undefined}
          {showApertureEllipseRatio ? (
            <MinorAxisRatioField
              id={ellipseRatioId}
              label="Aperture Ellipse Minor-Axis Ratio"
              value={draftEllipseMinorAxisRatio}
              onChange={setDraftEllipseMinorAxisRatio}
            />
          ) : undefined}
          <FormControl fullWidth size="small" error={!draftIsValid}>
            <InputLabel htmlFor={obstructionId}>Central Obstruction Ratio</InputLabel>
            <OutlinedInput
              id={obstructionId}
              label="Central Obstruction Ratio"
              value={draftObstructionRatio}
              inputProps={{
                inputMode: 'decimal',
                min: 0,
                max: 0.999,
                step: 0.01
              }}
              onChange={(event) => {
                if (isRatioText(event.target.value)) {
                  setDraftObstructionRatio(event.target.value);
                }
              }}
            />
            {!draftIsValid ? (
              <FormHelperText>Value must be at least 0 and less than 1.</FormHelperText>
            ) : undefined}
          </FormControl>
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
                <Stack spacing={1}>
                  <Typography id={obstructionRotationId} variant="body2">
                    Obstruction Rotation
                  </Typography>
                  <CommitSlider
                    ariaLabel="Obstruction Rotation"
                    min={0}
                    max={360}
                    step={1}
                    value={draftObstructionRotationDegrees}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value.toFixed(0)} deg`}
                    roundValue={Math.round}
                    onPreview={setDraftObstructionRotationDegrees}
                    onCommit={setDraftObstructionRotationDegrees}
                  />
                </Stack>
              ) : undefined}
              {showObstructionEllipseRatio ? (
                <MinorAxisRatioField
                  id={obstructionEllipseRatioId}
                  label="Obstruction Ellipse Minor-Axis Ratio"
                  value={draftObstructionEllipseMinorAxisRatio}
                  onChange={setDraftObstructionEllipseMinorAxisRatio}
                />
              ) : undefined}
            </>
          ) : undefined}
          <Box
            sx={{
              alignItems: 'center',
              bgcolor: 'background.default',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              display: 'flex',
              justifyContent: 'center',
              minHeight: 240,
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

interface MinorAxisRatioFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}

function MinorAxisRatioField({
  id,
  label,
  value,
  onChange
}: MinorAxisRatioFieldProps) {
  const parsedValue = Number(value);
  const isValid =
    value.trim() !== '' && Number.isFinite(parsedValue) && parsedValue > 0 && parsedValue <= 1;

  return (
    <FormControl fullWidth size="small" error={!isValid}>
      <InputLabel htmlFor={id}>{label}</InputLabel>
      <OutlinedInput
        id={id}
        label={label}
        value={value}
        inputProps={{
          inputMode: 'decimal',
          min: 0.01,
          max: 1,
          step: 0.01
        }}
        onChange={(event) => {
          if (isRatioText(event.target.value)) {
            onChange(event.target.value);
          }
        }}
      />
      {!isValid ? (
        <FormHelperText>Value must be greater than 0 and at most 1.</FormHelperText>
      ) : undefined}
    </FormControl>
  );
}

function formatShapeLabel(shape: ApertureShape): string {
  return apertureShapeOptions.find((option) => option.value === shape)?.label ?? shape;
}
