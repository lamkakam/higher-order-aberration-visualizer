import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
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
  const label = `${term.label} Z(${term.n},${term.m})`;
  const coefficientLabel = `${label} coefficient`;

  const commitSliderValue = useCallback(
    (nextValue: number) => {
      const roundedValue = roundToTwoDecimals(nextValue);
      if (roundedValue !== value) {
        onValueChange(term.key, roundedValue);
      }
    },
    [onValueChange, term.key, value]
  );

  return (
    <Box>
      <CommitSlider
        ariaLabel={coefficientLabel}
        label={label}
        min={zernikeCoefficientMin}
        max={zernikeCoefficientMax}
        step={zernikeCoefficientStep}
        value={value}
        input={{
          formatValue: (nextValue) => formatCommittedValue(nextValue, displayUnit),
          parseDraft: (draft) => getWaveValueFromDraft(draft, displayUnit),
          isDraftAllowed: isSignedDecimalDraft,
          isValidDraft: isValidCommittedDraft,
          getErrorText: (draft) =>
            isOutOfRangeDraft(draft, displayUnit) ? getRangeErrorText(displayUnit) : undefined,
          inputMode: 'decimal',
          inputMin: getDisplayValueFromWaves(zernikeCoefficientMin, displayUnit),
          inputMax: getDisplayValueFromWaves(zernikeCoefficientMax, displayUnit),
          inputStep: zernikeCoefficientStep,
          testId: `zernike-value-${term.key}`
        }}
        inputSyncKey={`${displayUnit}-${resetVersion}`}
        valueLabelDisplay="auto"
        valueLabelFormat={(nextValue) => formatCommittedValue(nextValue, displayUnit)}
        roundValue={roundToTwoDecimals}
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
