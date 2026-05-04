import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ZernikeCoefficientKey } from '../workers/types';
import { zernikeTerms } from './simulationConfig';

interface AberrationSlidersCardProps {
  readonly values: Record<ZernikeCoefficientKey, number>;
  readonly onValueChange: (key: ZernikeCoefficientKey, value: number) => void;
  readonly onReset: () => void;
}

export function AberrationSlidersCard({
  values,
  onValueChange,
  onReset
}: AberrationSlidersCardProps) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2.5}>
          <Typography variant="h5" component="h2">
            Optical Aberrations (Zernike)
          </Typography>
          <Box>
            <Button aria-label="Reset aberrations" variant="outlined" onClick={onReset}>
              Reset
            </Button>
          </Box>
          {zernikeTerms.map((term) => {
            const label = `${term.label} (${term.n},${term.m})`;
            return (
              <Box key={term.key}>
                <Box
                  sx={{
                    alignItems: 'baseline',
                    display: 'flex',
                    gap: 2,
                    justifyContent: 'space-between'
                  }}
                >
                  <Typography id={`zernike-label-${term.key}`} variant="body2">
                    {label}
                  </Typography>
                  <Typography
                    data-testid={`zernike-value-${term.key}`}
                    variant="body2"
                    color="text.secondary"
                  >
                    {values[term.key].toFixed(2)}
                  </Typography>
                </Box>
                <Slider
                  aria-label={label}
                  aria-labelledby={`zernike-label-${term.key}`}
                  min={-2}
                  max={2}
                  step={0.1}
                  value={values[term.key]}
                  valueLabelDisplay="auto"
                  onChange={(_, nextValue) => {
                    onValueChange(term.key, Array.isArray(nextValue) ? nextValue[0] : nextValue);
                  }}
                />
              </Box>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
}
