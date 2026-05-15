import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import NativeSelect from '@mui/material/NativeSelect';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import type { ChangeEvent, ReactNode } from 'react';
import { useId, useState } from 'react';
import type {
  ApertureMaskResult,
  ApertureSettings,
  SpectralMode,
  SupportedTargetId
} from '../../workers/types';
import type { DisplayMode } from '../SettingsDrawer';
import { NumberField } from '../NumberField';
import { targetOptions } from '../simulationConfig';
import { ApertureMaskModal } from './ApertureMaskModal';
import { formatApertureSummary } from './apertureMaskRules';

interface OpticalSystemConfigCardProps {
  readonly apertureDiameterMm: number;
  readonly apertureSettings: ApertureSettings;
  readonly displayMode: DisplayMode;
  readonly spectralMode: SpectralMode;
  readonly targetId: SupportedTargetId;
  readonly onApertureChange: (value: number) => void;
  readonly onApertureSettingsChange: (value: ApertureSettings) => void;
  readonly onRenderApertureMask: (value: ApertureSettings) => Promise<ApertureMaskResult>;
  readonly onSpectralModeChange: (value: SpectralMode) => void;
  readonly onTargetChange: (value: SupportedTargetId) => void;
}

export function OpticalSystemConfigCard({
  apertureDiameterMm,
  apertureSettings,
  displayMode,
  spectralMode,
  targetId,
  onApertureChange,
  onApertureSettingsChange,
  onRenderApertureMask,
  onSpectralModeChange,
  onTargetChange
}: OpticalSystemConfigCardProps) {
  const apertureHasError = !Number.isFinite(apertureDiameterMm) || apertureDiameterMm < 0.5;
  const accordionId = useId();
  const [isApertureModalOpen, setIsApertureModalOpen] = useState(false);

  function handleTargetChange(event: ChangeEvent<HTMLSelectElement>) {
    onTargetChange(event.target.value as SupportedTargetId);
  }

  const apertureInputId = `${accordionId}-aperture-diameter`;

  return (
    <Accordion
      defaultExpanded
      disableGutters
      sx={{
        '&::before': {
          display: 'none'
        },
        '& .MuiAccordionDetails-root, & .MuiAccordionSummary-root': {
          bgcolor: 'background.paper'
        },
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        boxShadow: 'none',
        overflow: 'hidden'
      }}
    >
      <AccordionSummary
        aria-controls={`${accordionId}-content`}
        expandIcon={<ExpandMoreIcon />}
        id={`${accordionId}-header`}
      >
        <Typography variant="h6" component="span">
          Optical System Config
        </Typography>
      </AccordionSummary>
      <AccordionDetails id={`${accordionId}-content`} sx={{ pt: 0 }}>
        <Stack spacing={2}>
          <ControlRow label="Aperture Diameter (mm)" htmlFor={apertureInputId}>
            <NumberField
              id={apertureInputId}
              label="Aperture Diameter (mm)"
              labelMode="external"
              min={0.5}
              error={apertureHasError}
              value={apertureDiameterMm}
              onChange={onApertureChange}
            />
          </ControlRow>
          <ControlRow label="Target" htmlFor="target-select">
            <FormControl fullWidth size="small">
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
          </ControlRow>
          {displayMode === 'advanced' ? (
            <Stack spacing={1}>
              <ControlRow
                labelContent={
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle2" component="p">
                      Aperture Mask
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatApertureSummary(apertureSettings)}
                    </Typography>
                  </Stack>
                }
              >
                <Button
                  aria-label="Edit aperture mask"
                  fullWidth
                  variant="outlined"
                  onClick={() => {
                    setIsApertureModalOpen(true);
                  }}
                >
                  Edit
                </Button>
              </ControlRow>
              <ControlRow
                labelContent={
                  <Typography id="spectral-mode-toggle-label" variant="subtitle2" component="p">
                    Spectral Mode
                  </Typography>
                }
              >
                <ToggleButtonGroup
                  aria-labelledby="spectral-mode-toggle-label"
                  color="primary"
                  exclusive
                  fullWidth
                  size="small"
                  value={spectralMode}
                  onChange={(_, nextMode: SpectralMode | undefined) => {
                    if (nextMode) {
                      onSpectralModeChange(nextMode);
                    }
                  }}
                >
                  <ToggleButton aria-label="Monochromatic" value="monochromatic">
                    Monochromatic
                  </ToggleButton>
                  <ToggleButton aria-label="Polychromatic" value="polychromatic">
                    Polychromatic
                  </ToggleButton>
                </ToggleButtonGroup>
              </ControlRow>
            </Stack>
          ) : undefined}
        </Stack>
      </AccordionDetails>
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
    </Accordion>
  );
}

interface ControlRowProps {
  readonly htmlFor?: string;
  readonly label?: string;
  readonly labelContent?: ReactNode;
  readonly children: ReactNode;
}

function ControlRow({ htmlFor, label, labelContent, children }: ControlRowProps) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'minmax(9rem, 0.75fr) minmax(0, 1.25fr)'
        },
        alignItems: 'center',
        columnGap: 1.5,
        rowGap: 0.75
      }}
    >
      {htmlFor ? (
        <Box component="label" htmlFor={htmlFor} sx={controlRowLabelSx}>
          {label}
        </Box>
      ) : (
        <Box sx={controlRowLabelSx}>{labelContent}</Box>
      )}
      {children}
    </Box>
  );
}

const controlRowLabelSx = {
  color: 'text.secondary',
  fontSize: '0.875rem',
  fontWeight: 500,
  lineHeight: 1.4
};
