import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import type { TFunction } from 'i18next';
import { memo, useCallback, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ZernikeCoefficientKey } from '../../types/domain';
import { CommitSlider } from '../CommitSlider';
import {
  type ZernikeTerm,
  micronsToWaves,
  roundToThreeDecimals,
  wavesToMicrons,
  zernikeCoefficientMax,
  zernikeCoefficientMin,
  zernikeCoefficientStep,
  zernikeTerms
} from '../lib/simulationConfig';

type CoefficientDisplayUnit = 'wave' | 'micron';

const coefficientDisplayUnits = [
  { value: 'wave', labelKey: 'opticalSystem.wave' },
  { value: 'micron', labelKey: 'opticalSystem.micron' }
] as const satisfies readonly {
  readonly value: CoefficientDisplayUnit;
  readonly labelKey: string;
}[];

const lowerOrderZernikeKeys = new Set<ZernikeCoefficientKey>(['2,-2', '2,0', '2,2']);
const lowerOrderZernikeTerms = zernikeTerms.filter((term) =>
  lowerOrderZernikeKeys.has(term.key)
);
const higherOrderZernikeOrders = [3, 4, 5, 6] as const;
const higherOrderZernikeTermGroups = higherOrderZernikeOrders.map((order) => ({
  order,
  terms: zernikeTerms.filter((term) => term.n === order)
}));

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
  const { t } = useTranslation();
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
            {t('aberrations.title')}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Button aria-label={t('aberrations.resetAria')} variant="outlined" onClick={handleReset}>
              {t('aberrations.reset')}
            </Button>
            {showWavelengthSyncControls ? (
              <Button
                aria-label={t('aberrations.resetAllWavelengths')}
                variant="outlined"
                onClick={handleResetAllWavelengths}
              >
                {t('aberrations.resetAllWavelengths')}
              </Button>
            ) : undefined}
          </Box>
          <Stack spacing={1}>
            <Typography variant="body2">{t('aberrations.coefficientUnit')}</Typography>
            <ButtonGroup aria-label={t('aberrations.coefficientUnit')} size="small" variant="outlined">
              {coefficientDisplayUnits.map((unit) => (
                <Button
                  key={unit.value}
                  aria-pressed={displayUnit === unit.value}
                  variant={displayUnit === unit.value ? 'contained' : 'outlined'}
                  onClick={() => {
                    setDisplayUnit(unit.value);
                  }}
                >
                  {t(unit.labelKey)}
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
                label={t('aberrations.syncWavelengths')}
              />
            ) : undefined}
          </Stack>
          <Stack spacing={1.5}>
            <ZernikeControlsAccordion
              title={t('aberrations.lowerOrder')}
              terms={lowerOrderZernikeTerms}
              values={values}
              wavelengthNm={wavelengthNm}
              displayUnit={displayUnit}
              resetVersion={resetVersion}
              onValueChange={onValueChange}
            />
            <Typography variant="h6" component="h3" sx={{ pt: 1 }}>
              {t('aberrations.higherOrder')}
            </Typography>
            {higherOrderZernikeTermGroups.map((group) => (
              <ZernikeControlsAccordion
                key={group.order}
                title={t(`aberrations.orders.${group.order}`)}
                terms={group.terms}
                values={values}
                wavelengthNm={wavelengthNm}
                displayUnit={displayUnit}
                resetVersion={resetVersion}
                onValueChange={onValueChange}
              />
            ))}
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
        borderRadius: 1,
        borderColor: 'divider',
        boxShadow: 'none',
        '&.Mui-expanded': {
          borderRadius: 1
        },
        '&:first-of-type': {
          borderRadius: 1
        },
        '&:last-of-type': {
          borderRadius: 1
        }
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
  const { t } = useTranslation();
  const translatedLabel = getZernikeTermLabel(term, t, 'full');
  const zernikeNotation = `Z(${term.n},${term.m})`;
  const coefficientLabel = t('aberrations.coefficientLabel', {
    label: translatedLabel,
    m: term.m,
    n: term.n
  });
  const visibleLabelChips = getVisibleZernikeLabelChips(term, t);

  const commitSliderValue = useCallback(
    (nextValue: number) => {
      const roundedValue = roundToThreeDecimals(nextValue);
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
        label={
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {visibleLabelChips.map((labelChip) => (
              <Chip
                key={labelChip}
                label={labelChip}
                size="small"
                variant="outlined"
                sx={{ maxWidth: '100%' }}
              />
            ))}
            <Chip label={zernikeNotation} size="small" variant="outlined" />
          </Box>
        }
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
              ? getRangeErrorText(displayUnit, wavelengthNm, t)
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
          inputStep: zernikeCoefficientStep,
          testId: `zernike-value-${term.key}`
        }}
        inputSyncKey={`${displayUnit}-${wavelengthNm}-${resetVersion}`}
        valueLabelDisplay="auto"
        valueLabelFormat={(nextValue) =>
          formatCommittedValue(nextValue, displayUnit, wavelengthNm)
        }
        roundValue={roundToThreeDecimals}
        onCommit={commitSliderValue}
      />
    </Box>
  );
});

function getVisibleZernikeLabelChips(term: ZernikeTerm, t: TFunction): readonly string[] {
  const label = getZernikeMainLabel(term, t, 'compact');
  const orientation = getZernikeOrientationLabel(term, t);

  return orientation === undefined ? [label] : [label, orientation];
}

function getZernikeTermLabel(
  term: ZernikeTerm,
  t: TFunction,
  orderLength: 'compact' | 'full'
): string {
  const label = getZernikeMainLabel(term, t, orderLength);
  const orientation = getZernikeOrientationLabel(term, t);

  return orientation === undefined
    ? label
    : t('aberrations.nameParts.orientationLabel', { label, orientation });
}

function getZernikeMainLabel(
  term: ZernikeTerm,
  t: TFunction,
  orderLength: 'compact' | 'full'
): string {
  const base = t(`aberrations.nameParts.bases.${term.name.base}`);
  const order =
    term.name.order === undefined
      ? undefined
      : t(`aberrations.nameParts.orders.${term.name.order}.${orderLength}`);

  return joinZernikeNameParts(order, base, t);
}

function getZernikeOrientationLabel(term: ZernikeTerm, t: TFunction): string | undefined {
  return term.name.orientation === undefined
    ? undefined
    : t(`aberrations.nameParts.orientations.${term.name.orientation}`);
}

function joinZernikeNameParts(order: string | undefined, base: string, t: TFunction): string {
  return order === undefined ? base : `${order}${t('aberrations.nameParts.orderSeparator')}${base}`;
}

function formatCommittedValue(
  value: number,
  displayUnit: CoefficientDisplayUnit,
  wavelengthNm: number
): string {
  return getDisplayValueFromWaves(value, displayUnit, wavelengthNm).toFixed(3);
}

function getDisplayValueFromWaves(
  value: number,
  displayUnit: CoefficientDisplayUnit,
  wavelengthNm: number
): number {
  if (displayUnit === 'micron') {
    return roundToThreeDecimals(wavesToMicrons(value, wavelengthNm));
  }

  return roundToThreeDecimals(value);
}

function getWaveValueFromDraft(
  draft: string,
  displayUnit: CoefficientDisplayUnit,
  wavelengthNm: number
): number {
  const value = Number(draft);
  if (displayUnit === 'micron') {
    return roundToThreeDecimals(micronsToWaves(value, wavelengthNm));
  }

  return value;
}

function getRangeErrorText(
  displayUnit: CoefficientDisplayUnit,
  wavelengthNm: number,
  t?: TFunction
): string {
  const min = getDisplayValueFromWaves(
    zernikeCoefficientMin,
    displayUnit,
    wavelengthNm
  );
  const max = getDisplayValueFromWaves(zernikeCoefficientMax, displayUnit, wavelengthNm);

  return t ? t('aberrations.rangeError', { min, max }) : `Value must be between ${min} and ${max}.`;
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
