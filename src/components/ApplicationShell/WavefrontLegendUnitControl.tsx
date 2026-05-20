import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import type { WavefrontLegendUnit } from '../../workers/types';

const wavefrontLegendUnitOptions = [
  { value: 'wave', labelKey: 'opticalSystem.wave' },
  { value: 'micron', labelKey: 'opticalSystem.micron' }
] as const;

interface WavefrontLegendUnitControlProps {
  readonly wavefrontLegendUnit: WavefrontLegendUnit;
  readonly onWavefrontLegendUnitChange: (unit: WavefrontLegendUnit) => void;
}

export function WavefrontLegendUnitControl({
  wavefrontLegendUnit,
  onWavefrontLegendUnitChange
}: WavefrontLegendUnitControlProps) {
  const { t } = useTranslation();

  return (
    <Box>
      <Typography
        id="wavefront-legend-unit-button-group-label"
        variant="subtitle1"
        sx={{ mb: 1 }}
      >
        {t('opticalSystem.legendUnit')}
      </Typography>
      <ButtonGroup aria-labelledby="wavefront-legend-unit-button-group-label" fullWidth>
        {wavefrontLegendUnitOptions.map((option) => (
          <Button
            key={option.value}
            aria-label={t(option.labelKey)}
            variant={wavefrontLegendUnit === option.value ? 'contained' : 'outlined'}
            onClick={() => {
              onWavefrontLegendUnitChange(option.value);
            }}
          >
            {t(option.labelKey)}
          </Button>
        ))}
      </ButtonGroup>
    </Box>
  );
}
