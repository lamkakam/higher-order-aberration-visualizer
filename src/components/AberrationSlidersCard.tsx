import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { memo, useCallback, useState } from 'react';
import type { ZernikeCoefficientKey } from '../workers/types';
import { CommitSlider } from './CommitSlider';
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
  const [resetVersion, setResetVersion] = useState(0);

  const handleReset = useCallback(() => {
    setResetVersion((currentVersion) => currentVersion + 1);
    onReset();
  }, [onReset]);

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2.5}>
          <Typography variant="h5" component="h2">
            Optical Aberrations (Zernike)
          </Typography>
          <Box>
            <Button aria-label="Reset aberrations" variant="outlined" onClick={handleReset}>
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
          {zernikeTerms.map((term) => (
            <AberrationCoefficientRow
              key={term.key}
              term={term}
              value={values[term.key]}
              displayUnit={displayUnit}
              resetVersion={resetVersion}
              onValueChange={onValueChange}
            />
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

interface AberrationCoefficientRowProps {
  readonly term: (typeof zernikeTerms)[number];
  readonly value: number;
  readonly displayUnit: CoefficientDisplayUnit;
  readonly resetVersion: number;
  readonly onValueChange: (key: ZernikeCoefficientKey, value: number) => void;
}

const AberrationCoefficientRow = memo(function AberrationCoefficientRow({
  term,
  value,
  displayUnit,
  resetVersion,
  onValueChange
}: AberrationCoefficientRowProps) {
  const [rowState, setRowState] = useState({
    committedValue: value,
    displayUnit,
    draftValue: formatCommittedValue(value, displayUnit),
    resetVersion,
    sliderValue: value
  });
  let currentRowState = rowState;

  if (
    currentRowState.committedValue !== value ||
    currentRowState.displayUnit !== displayUnit ||
    currentRowState.resetVersion !== resetVersion
  ) {
    currentRowState = {
      committedValue: value,
      displayUnit,
      draftValue: formatCommittedValue(value, displayUnit),
      resetVersion,
      sliderValue: value
    };
    setRowState(currentRowState);
  }

  const label = `${term.label} Z(${term.n},${term.m})`;
  const coefficientLabel = `${label} coefficient`;
  const hasDraftRangeError = isOutOfRangeDraft(currentRowState.draftValue, displayUnit);

  const commitDraft = useCallback(
    (nextDraft: string) => {
      const nextValue = getWaveValueFromDraft(nextDraft, displayUnit);
      if (isValidCommittedDraft(nextDraft, nextValue) && nextValue !== value) {
        onValueChange(term.key, nextValue);
      }
    },
    [displayUnit, onValueChange, term.key, value]
  );

  const flushDraft = useCallback(() => {
    commitDraft(currentRowState.draftValue);
  }, [commitDraft, currentRowState.draftValue]);

  const commitSliderValue = useCallback(
    (nextValue: number) => {
      const roundedValue = roundToTwoDecimals(nextValue);
      setRowState((previousState) => ({
        ...previousState,
        draftValue: formatCommittedValue(roundedValue, displayUnit),
        sliderValue: roundedValue
      }));
      if (roundedValue !== value) {
        onValueChange(term.key, roundedValue);
      }
    },
    [displayUnit, onValueChange, term.key, value]
  );

  return (
    <Box>
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
          value={currentRowState.draftValue}
          onChange={(event) => {
            const nextDraft = event.target.value;
            if (isSignedDecimalDraft(nextDraft)) {
              setRowState((previousState) => ({
                ...previousState,
                draftValue: nextDraft
              }));
            }
          }}
          onBlur={flushDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              flushDraft();
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
      <CommitSlider
        ariaLabel={coefficientLabel}
        min={zernikeCoefficientMin}
        max={zernikeCoefficientMax}
        step={zernikeCoefficientStep}
        value={currentRowState.sliderValue}
        valueLabelDisplay="auto"
        valueLabelFormat={(nextValue) => formatCommittedValue(nextValue, displayUnit)}
        roundValue={roundToTwoDecimals}
        onPreview={(roundedValue) => {
          setRowState((previousState) => ({
            ...previousState,
            sliderValue: roundedValue
          }));
        }}
        onCommit={commitSliderValue}
      />
    </Box>
  );
});

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
