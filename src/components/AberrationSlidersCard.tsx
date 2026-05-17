import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { memo, useCallback, useId, useState } from 'react';
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

type ZernikeTerm = (typeof zernikeTerms)[number];

const lowerOrderZernikeKeys = new Set<ZernikeCoefficientKey>(['2,-2', '2,0', '2,2']);
const lowerOrderZernikeTerms = zernikeTerms.filter((term) =>
  lowerOrderZernikeKeys.has(term.key)
);
const higherOrderZernikeTerms = zernikeTerms.filter(
  (term) => !lowerOrderZernikeKeys.has(term.key)
);

interface AberrationSlidersCardProps {
  readonly wavelengthNm: number;
  readonly values: Record<ZernikeCoefficientKey, number>;
  readonly onValueChange: (key: ZernikeCoefficientKey, value: number) => void;
  readonly onReset: () => void;
  readonly showWavelengthSyncControls?: boolean;
  readonly syncWavelengthCoefficients?: boolean;
  readonly onSyncWavelengthCoefficientsChange?: (enabled: boolean) => void;
  readonly onResetAllWavelengths?: () => void;
}

export function AberrationSlidersCard({
  wavelengthNm,
  values,
  onValueChange,
  onReset,
  showWavelengthSyncControls = false,
  syncWavelengthCoefficients = true,
  onSyncWavelengthCoefficientsChange,
  onResetAllWavelengths
}: AberrationSlidersCardProps) {
  const [displayUnit, setDisplayUnit] = useState<CoefficientDisplayUnit>('wave');
  const [resetVersion, setResetVersion] = useState(0);

  const handleReset = useCallback(() => {
    setResetVersion((currentVersion) => currentVersion + 1);
    onReset();
  }, [onReset]);

  const handleResetAllWavelengths = useCallback(() => {
    setResetVersion((currentVersion) => currentVersion + 1);
    onResetAllWavelengths?.();
  }, [onResetAllWavelengths]);

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2.5}>
          <Typography variant="h6" component="h2">
            Optical Aberrations (Zernike)
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Button aria-label="Reset aberrations" variant="outlined" onClick={handleReset}>
              Reset
            </Button>
            {showWavelengthSyncControls ? (
              <Button
                aria-label="Reset all wavelengths"
                variant="outlined"
                onClick={handleResetAllWavelengths}
              >
                Reset all wavelengths
              </Button>
            ) : undefined}
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
            {showWavelengthSyncControls ? (
              <FormControlLabel
                control={
                  <Switch
                    checked={syncWavelengthCoefficients}
                    onChange={(_, checked) => {
                      onSyncWavelengthCoefficientsChange?.(checked);
                    }}
                  />
                }
                label="Sync wavelengths"
              />
            ) : undefined}
          </Stack>
          <Stack spacing={1.5}>
            <ZernikeControlsAccordion
              title="Lower Order Aberrations (Generally Correctable with Ordinary Eyeglasses)"
              terms={lowerOrderZernikeTerms}
              values={values}
              wavelengthNm={wavelengthNm}
              displayUnit={displayUnit}
              resetVersion={resetVersion}
              onValueChange={onValueChange}
            />
            <ZernikeControlsAccordion
              title="Higher Order Aberrations"
              terms={higherOrderZernikeTerms}
              values={values}
              wavelengthNm={wavelengthNm}
              displayUnit={displayUnit}
              resetVersion={resetVersion}
              onValueChange={onValueChange}
            />
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

interface ZernikeControlsAccordionProps {
  readonly title: string;
  readonly terms: readonly ZernikeTerm[];
  readonly values: Record<ZernikeCoefficientKey, number>;
  readonly wavelengthNm: number;
  readonly displayUnit: CoefficientDisplayUnit;
  readonly resetVersion: number;
  readonly onValueChange: (key: ZernikeCoefficientKey, value: number) => void;
}

function ZernikeControlsAccordion({
  title,
  terms,
  values,
  wavelengthNm,
  displayUnit,
  resetVersion,
  onValueChange
}: ZernikeControlsAccordionProps) {
  const accordionId = useId();

  return (
    <Accordion
      defaultExpanded
      disableGutters
      sx={{
        '&::before': {
          display: 'none'
        },
        border: 1,
        borderColor: 'divider',
        boxShadow: 'none'
      }}
    >
      <AccordionSummary
        aria-controls={`${accordionId}-content`}
        aria-label={title}
        expandIcon={<ExpandMoreIcon />}
        id={`${accordionId}-header`}
      >
        <Typography variant="h6" component="span">
          {title}
        </Typography>
      </AccordionSummary>
      <AccordionDetails
        id={`${accordionId}-content`}
        sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 0 }}
      >
        {terms.map((term) => (
          <AberrationCoefficientRow
            key={term.key}
            term={term}
            value={values[term.key]}
            wavelengthNm={wavelengthNm}
            displayUnit={displayUnit}
            resetVersion={resetVersion}
            onValueChange={onValueChange}
          />
        ))}
      </AccordionDetails>
    </Accordion>
  );
}

interface AberrationCoefficientRowProps {
  readonly term: ZernikeTerm;
  readonly value: number;
  readonly wavelengthNm: number;
  readonly displayUnit: CoefficientDisplayUnit;
  readonly resetVersion: number;
  readonly onValueChange: (key: ZernikeCoefficientKey, value: number) => void;
}

const AberrationCoefficientRow = memo(function AberrationCoefficientRow({
  term,
  value,
  wavelengthNm,
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
          formatValue: (nextValue) =>
            formatCommittedValue(nextValue, displayUnit, wavelengthNm),
          parseDraft: (draft) => getWaveValueFromDraft(draft, displayUnit, wavelengthNm),
          isDraftAllowed: isSignedDecimalDraft,
          isValidDraft: isValidCommittedDraft,
          getErrorText: (draft) =>
            isOutOfRangeDraft(draft, displayUnit, wavelengthNm)
              ? getRangeErrorText(displayUnit, wavelengthNm)
              : undefined,
          inputMode: 'decimal',
          inputMin: getDisplayValueFromWaves(
            zernikeCoefficientMin,
            displayUnit,
            wavelengthNm
          ),
          inputMax: getDisplayValueFromWaves(
            zernikeCoefficientMax,
            displayUnit,
            wavelengthNm
          ),
          inputStep: getDisplayValueFromWaves(
            zernikeCoefficientStep,
            displayUnit,
            wavelengthNm
          ),
          testId: `zernike-value-${term.key}`
        }}
        inputSyncKey={`${displayUnit}-${wavelengthNm}-${resetVersion}`}
        valueLabelDisplay="auto"
        valueLabelFormat={(nextValue) =>
          formatCommittedValue(nextValue, displayUnit, wavelengthNm)
        }
        roundValue={roundToTwoDecimals}
        onCommit={commitSliderValue}
      />
    </Box>
  );
});

function formatCommittedValue(
  value: number,
  displayUnit: CoefficientDisplayUnit,
  wavelengthNm: number
): string {
  return getDisplayValueFromWaves(value, displayUnit, wavelengthNm).toFixed(2);
}

function getDisplayValueFromWaves(
  value: number,
  displayUnit: CoefficientDisplayUnit,
  wavelengthNm: number
): number {
  if (displayUnit === 'micron') {
    return roundToTwoDecimals(wavesToMicrons(value, wavelengthNm));
  }

  return roundToTwoDecimals(value);
}

function getWaveValueFromDraft(
  draft: string,
  displayUnit: CoefficientDisplayUnit,
  wavelengthNm: number
): number {
  const value = Number(draft);
  if (displayUnit === 'micron') {
    return roundToTwoDecimals(micronsToWaves(value, wavelengthNm));
  }

  return value;
}

function getRangeErrorText(
  displayUnit: CoefficientDisplayUnit,
  wavelengthNm: number
): string {
  return `Value must be between ${getDisplayValueFromWaves(
    zernikeCoefficientMin,
    displayUnit,
    wavelengthNm
  )} and ${getDisplayValueFromWaves(zernikeCoefficientMax, displayUnit, wavelengthNm)}.`;
}

function isValidCommittedDraft(draft: string, value: number): boolean {
  return (
    draft.trim() !== '' &&
    Number.isFinite(value) &&
    value >= zernikeCoefficientMin &&
    value <= zernikeCoefficientMax
  );
}

function isOutOfRangeDraft(
  draft: string,
  displayUnit: CoefficientDisplayUnit,
  wavelengthNm: number
): boolean {
  const value = getWaveValueFromDraft(draft, displayUnit, wavelengthNm);
  return (
    draft.trim() !== '' &&
    Number.isFinite(value) &&
    (value < zernikeCoefficientMin || value > zernikeCoefficientMax)
  );
}

function isSignedDecimalDraft(value: string): boolean {
  return value === '' || /^-?(?:\d+\.?\d*|\.\d*)?$/.test(value);
}
