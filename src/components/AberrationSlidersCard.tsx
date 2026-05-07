import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
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
  const [draftState, setDraftState] = useState(() => createDraftState(values));

  let draftValues = draftState.draftValues;
  if (!areCommittedValuesEqual(draftState.committedValues, values)) {
    draftValues = reconcileDraftValues(draftValues, values);
    setDraftState({
      committedValues: values,
      draftValues
    });
  }

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
            const label = `${term.label} Z(${term.n},${term.m})`;
            const coefficientLabel = `${label} coefficient`;
            const hasDraftRangeError = isOutOfRangeDraft(draftValues[term.key]);
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
                  <Typography variant="body2">{label}</Typography>
                  <TextField
                    data-testid={`zernike-value-${term.key}`}
                    autoComplete="off"
                    error={hasDraftRangeError}
                    helperText={hasDraftRangeError ? 'Value must be between -2 and 2.' : undefined}
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

                      setDraftState((currentState) => ({
                        committedValues: values,
                        draftValues: {
                          ...currentState.draftValues,
                          [term.key]: nextDraft
                        }
                      }));

                      const nextValue = Number(nextDraft);
                      if (isValidCommittedDraft(nextDraft, nextValue)) {
                        onValueChange(term.key, nextValue);
                      }
                    }}
                    slotProps={{
                      htmlInput: {
                        'aria-label': coefficientLabel,
                        autoComplete: 'off',
                        min: zernikeCoefficientMin,
                        max: zernikeCoefficientMax,
                        step: zernikeCoefficientStep
                      }
                    }}
                  />
                </Box>
                <Slider
                  aria-label={coefficientLabel}
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

interface DraftState {
  readonly committedValues: Record<ZernikeCoefficientKey, number>;
  readonly draftValues: Record<ZernikeCoefficientKey, string>;
}

function createDraftState(values: Record<ZernikeCoefficientKey, number>): DraftState {
  return {
    committedValues: values,
    draftValues: createDraftValues(values)
  };
}

function createDraftValues(
  values: Record<ZernikeCoefficientKey, number>
): Record<ZernikeCoefficientKey, string> {
  return Object.fromEntries(
    zernikeTerms.map((term) => [term.key, formatCommittedValue(values[term.key])])
  ) as Record<ZernikeCoefficientKey, string>;
}

function reconcileDraftValues(
  draftValues: Record<ZernikeCoefficientKey, string>,
  values: Record<ZernikeCoefficientKey, number>
): Record<ZernikeCoefficientKey, string> {
  return Object.fromEntries(
    zernikeTerms.map((term) => {
      const currentDraft = draftValues[term.key];
      const parsedDraft = Number(currentDraft);
      const nextDraft =
        Number.isFinite(parsedDraft) && parsedDraft === values[term.key]
          ? currentDraft
          : formatCommittedValue(values[term.key]);

      return [term.key, nextDraft];
    })
  ) as Record<ZernikeCoefficientKey, string>;
}

function areCommittedValuesEqual(
  previousValues: Record<ZernikeCoefficientKey, number>,
  nextValues: Record<ZernikeCoefficientKey, number>
): boolean {
  return zernikeTerms.every((term) => previousValues[term.key] === nextValues[term.key]);
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

function isOutOfRangeDraft(draft: string): boolean {
  const value = Number(draft);
  return (
    draft.trim() !== '' &&
    Number.isFinite(value) &&
    (value < zernikeCoefficientMin || value > zernikeCoefficientMax)
  );
}

function isSignedDecimalDraft(value: string): boolean {
  return value === '' || /^-?(?:\d+\.?\d*|\.\d*)?$/.test(value);
}
