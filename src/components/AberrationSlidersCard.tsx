import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import type { ZernikeCoefficientKey } from '../workers/types';
import {
  micronsToWaves,
  roundToTwoDecimals,
  wavesToMicrons,
  zernikeCoefficientMax,
  zernikeCoefficientMin,
  zernikeCoefficientStep,
  zernikeTerms
} from './simulationConfig';

type CoefficientDisplayUnit = 'wave' | 'micron';

const coefficientDisplayUnits = [
  { value: 'wave', label: 'Wave' },
  { value: 'micron', label: 'Micron' }
] as const satisfies readonly {
  readonly value: CoefficientDisplayUnit;
  readonly label: string;
}[];

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
  const [displayUnit, setDisplayUnit] = useState<CoefficientDisplayUnit>('wave');
  const [draftState, setDraftState] = useState(() => createDraftState(values, displayUnit));

  let draftValues = draftState.draftValues;
  if (draftState.displayUnit !== displayUnit) {
    draftValues = createDraftValues(values, displayUnit);
    setDraftState({
      committedValues: values,
      displayUnit,
      draftValues
    });
  } else if (!areCommittedValuesEqual(draftState.committedValues, values)) {
    draftValues = reconcileDraftValues(draftValues, values, displayUnit);
    setDraftState({
      committedValues: values,
      displayUnit,
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
          <Stack spacing={1}>
            <Typography variant="body2">Coefficient Unit (RMS)</Typography>
            <ButtonGroup aria-label="Coefficient Unit (RMS)" size="small" variant="outlined">
              {coefficientDisplayUnits.map((unit) => (
                <Button
                  key={unit.value}
                  aria-pressed={displayUnit === unit.value}
                  variant={displayUnit === unit.value ? 'contained' : 'outlined'}
                  onClick={() => {
                    setDisplayUnit(unit.value);
                  }}
                >
                  {unit.label}
                </Button>
              ))}
            </ButtonGroup>
          </Stack>
          {zernikeTerms.map((term) => {
            const label = `${term.label} Z(${term.n},${term.m})`;
            const coefficientLabel = `${label} coefficient`;
            const hasDraftRangeError = isOutOfRangeDraft(draftValues[term.key], displayUnit);
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
                    helperText={hasDraftRangeError ? getRangeErrorText(displayUnit) : undefined}
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
                        displayUnit,
                        draftValues: {
                          ...currentState.draftValues,
                          [term.key]: nextDraft
                        }
                      }));

                      const nextValue = getWaveValueFromDraft(nextDraft, displayUnit);
                      if (isValidCommittedDraft(nextDraft, nextValue)) {
                        onValueChange(term.key, nextValue);
                      }
                    }}
                    slotProps={{
                      htmlInput: {
                        'aria-label': coefficientLabel,
                        autoComplete: 'off',
                        min: getDisplayValueFromWaves(zernikeCoefficientMin, displayUnit),
                        max: getDisplayValueFromWaves(zernikeCoefficientMax, displayUnit),
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
                  valueLabelFormat={(value) => formatCommittedValue(value, displayUnit)}
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
  readonly displayUnit: CoefficientDisplayUnit;
  readonly draftValues: Record<ZernikeCoefficientKey, string>;
}

function createDraftState(
  values: Record<ZernikeCoefficientKey, number>,
  displayUnit: CoefficientDisplayUnit
): DraftState {
  return {
    committedValues: values,
    displayUnit,
    draftValues: createDraftValues(values, displayUnit)
  };
}

function createDraftValues(
  values: Record<ZernikeCoefficientKey, number>,
  displayUnit: CoefficientDisplayUnit
): Record<ZernikeCoefficientKey, string> {
  return Object.fromEntries(
    zernikeTerms.map((term) => [term.key, formatCommittedValue(values[term.key], displayUnit)])
  ) as Record<ZernikeCoefficientKey, string>;
}

function reconcileDraftValues(
  draftValues: Record<ZernikeCoefficientKey, string>,
  values: Record<ZernikeCoefficientKey, number>,
  displayUnit: CoefficientDisplayUnit
): Record<ZernikeCoefficientKey, string> {
  return Object.fromEntries(
    zernikeTerms.map((term) => {
      const currentDraft = draftValues[term.key];
      const parsedDraft = Number(currentDraft);
      const displayValue = getDisplayValueFromWaves(values[term.key], displayUnit);
      const nextDraft =
        Number.isFinite(parsedDraft) && parsedDraft === displayValue
          ? currentDraft
          : formatCommittedValue(values[term.key], displayUnit);

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

function formatCommittedValue(value: number, displayUnit: CoefficientDisplayUnit): string {
  return getDisplayValueFromWaves(value, displayUnit).toFixed(2);
}

function getDisplayValueFromWaves(value: number, displayUnit: CoefficientDisplayUnit): number {
  if (displayUnit === 'micron') {
    return roundToTwoDecimals(wavesToMicrons(value));
  }

  return roundToTwoDecimals(value);
}

function getWaveValueFromDraft(
  draft: string,
  displayUnit: CoefficientDisplayUnit
): number {
  const value = Number(draft);
  if (displayUnit === 'micron') {
    return roundToTwoDecimals(micronsToWaves(value));
  }

  return value;
}

function getRangeErrorText(displayUnit: CoefficientDisplayUnit): string {
  return `Value must be between ${getDisplayValueFromWaves(
    zernikeCoefficientMin,
    displayUnit
  )} and ${getDisplayValueFromWaves(zernikeCoefficientMax, displayUnit)}.`;
}

function isValidCommittedDraft(draft: string, value: number): boolean {
  return (
    draft.trim() !== '' &&
    Number.isFinite(value) &&
    value >= zernikeCoefficientMin &&
    value <= zernikeCoefficientMax
  );
}

function isOutOfRangeDraft(draft: string, displayUnit: CoefficientDisplayUnit): boolean {
  const value = getWaveValueFromDraft(draft, displayUnit);
  return (
    draft.trim() !== '' &&
    Number.isFinite(value) &&
    (value < zernikeCoefficientMin || value > zernikeCoefficientMax)
  );
}

function isSignedDecimalDraft(value: string): boolean {
  return value === '' || /^-?(?:\d+\.?\d*|\.\d*)?$/.test(value);
}
