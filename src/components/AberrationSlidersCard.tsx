import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import type { ZernikeCoefficientKey } from '../workers/types';
import {
  roundToTwoDecimals,
  zernikeCoefficientMax,
  zernikeCoefficientMin,
  zernikeCoefficientStep,
  zernikeTerms
} from './simulationConfig';

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
  const [draftValues, setDraftValues] = useState(() => createDraftValues(values));

  useEffect(() => {
    setDraftValues((currentDrafts) =>
      Object.fromEntries(
        zernikeTerms.map((term) => {
          const currentDraft = currentDrafts[term.key];
          const parsedDraft = Number(currentDraft);
          const nextDraft =
            Number.isFinite(parsedDraft) && parsedDraft === values[term.key]
              ? currentDraft
              : formatCommittedValue(values[term.key]);

          return [term.key, nextDraft];
        })
      ) as Record<ZernikeCoefficientKey, string>
    );
  }, [values]);

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
                  <TextField
                    data-testid={`zernike-value-${term.key}`}
                    inputMode="decimal"
                    size="small"
                    sx={{
                      '& input': {
                        py: 0.5,
                        textAlign: 'right',
                        width: '4.5rem'
                      }
                    }}
                    type="text"
                    value={draftValues[term.key]}
                    onChange={(event) => {
                      const nextDraft = event.target.value;
                      if (!isSignedDecimalDraft(nextDraft)) {
                        return;
                      }

                      setDraftValues((currentDrafts) => ({
                        ...currentDrafts,
                        [term.key]: nextDraft
                      }));

                      const nextValue = Number(nextDraft);
                      if (isValidCommittedDraft(nextDraft, nextValue)) {
                        onValueChange(term.key, nextValue);
                      }
                    }}
                    slotProps={{
                      htmlInput: {
                        'aria-label': `${label} coefficient`,
                        min: zernikeCoefficientMin,
                        max: zernikeCoefficientMax,
                        step: zernikeCoefficientStep
                      }
                    }}
                  />
                </Box>
                <Slider
                  aria-label={label}
                  aria-labelledby={`zernike-label-${term.key}`}
                  min={zernikeCoefficientMin}
                  max={zernikeCoefficientMax}
                  step={zernikeCoefficientStep}
                  value={values[term.key]}
                  valueLabelDisplay="auto"
                  onChange={(_, nextValue) => {
                    onValueChange(
                      term.key,
                      roundToTwoDecimals(Array.isArray(nextValue) ? nextValue[0] : nextValue)
                    );
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

function createDraftValues(
  values: Record<ZernikeCoefficientKey, number>
): Record<ZernikeCoefficientKey, string> {
  return Object.fromEntries(
    zernikeTerms.map((term) => [term.key, formatCommittedValue(values[term.key])])
  ) as Record<ZernikeCoefficientKey, string>;
}

function formatCommittedValue(value: number): string {
  return roundToTwoDecimals(value).toFixed(2);
}

function isValidCommittedDraft(draft: string, value: number): boolean {
  return (
    draft.trim() !== '' &&
    Number.isFinite(value) &&
    value >= zernikeCoefficientMin &&
    value <= zernikeCoefficientMax
  );
}

function isSignedDecimalDraft(value: string): boolean {
  return value === '' || /^-?(?:\d+\.?\d*|\.\d*)?$/.test(value);
}
