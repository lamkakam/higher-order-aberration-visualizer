import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import NativeSelect from '@mui/material/NativeSelect';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ChangeEvent } from 'react';
import type { SupportedTargetId } from '../workers/types';
import { NumberField } from './NumberField';
import { targetOptions } from './simulationConfig';

interface OpticalSystemConfigCardProps {
  readonly apertureDiameterMm: number;
  readonly targetId: SupportedTargetId;
  readonly onApertureChange: (value: number) => void;
  readonly onTargetChange: (value: SupportedTargetId) => void;
}

export function OpticalSystemConfigCard({
  apertureDiameterMm,
  targetId,
  onApertureChange,
  onTargetChange
}: OpticalSystemConfigCardProps) {
  const apertureHasError = !Number.isFinite(apertureDiameterMm) || apertureDiameterMm < 0.5;

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
        </Stack>
      </CardContent>
    </Card>
  );
}
