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
import { NumberField } from './NumberField';
import { targetOptions } from './simulationConfig';

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
  const obstructionId = useId();
  const [draftShape, setDraftShape] = useState<ApertureShape>(apertureSettings.shape);
  const [draftObstructionRatio, setDraftObstructionRatio] = useState(
    String(apertureSettings.centralObstructionRatio)
  );
  const [preview, setPreview] = useState<ApertureMaskResult | undefined>(undefined);
  const [previewError, setPreviewError] = useState<string | undefined>(undefined);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const parsedObstructionRatio = Number(draftObstructionRatio);
  const draftIsValid =
    draftObstructionRatio.trim() !== '' &&
    Number.isFinite(parsedObstructionRatio) &&
    parsedObstructionRatio >= 0 &&
    parsedObstructionRatio < 1;
  const draftSettings = useMemo<ApertureSettings | undefined>(
    () =>
      draftIsValid
        ? {
            shape: draftShape,
            centralObstructionRatio: parsedObstructionRatio
          }
        : undefined,
    [draftIsValid, draftShape, parsedObstructionRatio]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraftShape(apertureSettings.shape);
    setDraftObstructionRatio(String(apertureSettings.centralObstructionRatio));
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
              <option value="circle">Circle</option>
            </NativeSelect>
          </FormControl>
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
  return `Circle, ${obstructionPercent.toLocaleString(undefined, {
    maximumFractionDigits: 1
  })}% obstruction`;
}

function isRatioText(value: string) {
  return value === '' || /^(?:\d+\.?\d*|\.\d+)$/.test(value);
}
