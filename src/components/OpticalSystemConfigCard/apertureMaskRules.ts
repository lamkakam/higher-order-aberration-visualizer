import type { ApertureSettings, ApertureShape } from '../../workers/types';
import type { TFunction } from 'i18next';

export const apertureShapeOptions = [
  { value: 'circle', label: 'Circle', labelKey: 'apertureMask.circle' },
  { value: 'square', label: 'Square', labelKey: 'apertureMask.square' },
  {
    value: 'regular_hexagon',
    label: 'Regular Hexagon',
    labelKey: 'apertureMask.regularHexagon'
  }
] as const satisfies readonly {
  readonly value: ApertureShape;
  readonly label: string;
  readonly labelKey: string;
}[];

export const rotationSliderInput = {
  formatValue: (value: number) => String(Math.round(value)),
  parseDraft: (draft: string) => Number(draft),
  isDraftAllowed: (draft: string) => draft === '' || /^\d*$/.test(draft),
  isValidDraft: (draft: string, parsedValue: number) =>
    draft.trim() !== '' &&
    Number.isFinite(parsedValue) &&
    parsedValue >= 0 &&
    parsedValue <= 360,
  getErrorText: (draft: string, parsedValue: number) =>
    draft.trim() !== '' &&
    Number.isFinite(parsedValue) &&
    (parsedValue < 0 || parsedValue > 360)
      ? 'Value must be between 0 and 360.'
      : undefined,
  inputMode: 'numeric' as const,
  inputMin: 0,
  inputMax: 360,
  inputStep: 1
};

export const ratioSliderInput = {
  formatValue: formatRatioValue,
  parseDraft: (draft: string) => Number(draft),
  isDraftAllowed: isRatioText,
  isValidDraft: (draft: string, parsedValue: number) =>
    draft.trim() !== '' &&
    Number.isFinite(parsedValue) &&
    parsedValue >= 0 &&
    parsedValue < 1,
  getErrorText: (draft: string, parsedValue: number) =>
    draft.trim() !== '' &&
    Number.isFinite(parsedValue) &&
    (parsedValue < 0 || parsedValue >= 1)
      ? 'Value must be at least 0 and less than 1.'
      : undefined,
  inputMode: 'decimal' as const,
  inputMin: 0,
  inputMax: 0.999,
  inputStep: 0.01
};

export const gaussianSigmaRatioSliderInput = {
  formatValue: formatRatioValue,
  parseDraft: (draft: string) => Number(draft),
  isDraftAllowed: isRatioText,
  isValidDraft: (draft: string, parsedValue: number) =>
    draft.trim() !== '' &&
    Number.isFinite(parsedValue) &&
    parsedValue >= 0.05 &&
    parsedValue <= 1,
  getErrorText: (draft: string, parsedValue: number) =>
    draft.trim() !== '' &&
    Number.isFinite(parsedValue) &&
    (parsedValue < 0.05 || parsedValue > 1)
      ? 'Value must be between 0.05 and 1.'
      : undefined,
  inputMode: 'decimal' as const,
  inputMin: 0.05,
  inputMax: 1,
  inputStep: 0.01
};

export const spiderVaneCountSliderInput = {
  formatValue: (value: number) => String(Math.round(value)),
  parseDraft: (draft: string) => Number(draft),
  isDraftAllowed: (draft: string) => draft === '' || /^\d*$/.test(draft),
  isValidDraft: (draft: string, parsedValue: number) =>
    draft.trim() !== '' &&
    Number.isFinite(parsedValue) &&
    Number.isInteger(parsedValue) &&
    parsedValue >= 0 &&
    parsedValue <= 12,
  getErrorText: (draft: string, parsedValue: number) =>
    draft.trim() !== '' &&
    Number.isFinite(parsedValue) &&
    (parsedValue < 0 || parsedValue > 12)
      ? 'Value must be between 0 and 12.'
      : undefined,
  inputMode: 'numeric' as const,
  inputMin: 0,
  inputMax: 12,
  inputStep: 1
};

export const spiderVaneWidthRatioSliderInput = {
  formatValue: formatRatioValue,
  parseDraft: (draft: string) => Number(draft),
  isDraftAllowed: isRatioText,
  isValidDraft: (draft: string, parsedValue: number) =>
    draft.trim() !== '' &&
    Number.isFinite(parsedValue) &&
    parsedValue >= 0 &&
    parsedValue <= 0.25,
  getErrorText: (draft: string, parsedValue: number) =>
    draft.trim() !== '' &&
    Number.isFinite(parsedValue) &&
    (parsedValue < 0 || parsedValue > 0.25)
      ? 'Value must be between 0 and 0.25.'
      : undefined,
  inputMode: 'decimal' as const,
  inputMin: 0,
  inputMax: 0.25,
  inputStep: 0.01
};

export interface ApertureMaskDraftState {
  readonly shape: ApertureShape;
  readonly rotationDegrees: number;
  readonly centralObstructionRatio: number;
  readonly centralObstructionShape: ApertureShape;
  readonly centralObstructionRotationDegrees: number;
  readonly gaussianApodizationEnabled: boolean;
  readonly gaussianApodizationSigmaRatio: number;
  readonly spiderVaneCount: number;
  readonly spiderVaneWidthRatio: number;
  readonly spiderVaneRotationDegrees: number;
}

export interface ApertureMaskVisibility {
  readonly showApertureRotation: boolean;
  readonly showObstructionControls: boolean;
  readonly showObstructionRotation: boolean;
  readonly showGaussianSigma: boolean;
}

export function getApertureMaskModalDraftKey(settings: ApertureSettings): string {
  return [
    settings.shape,
    settings.rotationDegrees,
    settings.centralObstructionRatio,
    settings.centralObstructionShape,
    settings.centralObstructionRotationDegrees,
    settings.gaussianApodizationEnabled,
    settings.gaussianApodizationSigmaRatio,
    settings.spiderVaneCount,
    settings.spiderVaneWidthRatio,
    settings.spiderVaneRotationDegrees
  ].join('|');
}

export function getApertureMaskVisibility(
  draft: ApertureMaskDraftState,
  normalizedDraft: ApertureSettings | undefined
): ApertureMaskVisibility {
  const showObstructionControls =
    normalizedDraft !== undefined && draft.centralObstructionRatio > 0;

  return {
    showApertureRotation: draft.shape !== 'circle',
    showObstructionControls,
    showObstructionRotation:
      showObstructionControls && draft.centralObstructionShape !== 'circle',
    showGaussianSigma: draft.gaussianApodizationEnabled
  };
}

export function normalizeApertureMaskDraft(
  draft: ApertureMaskDraftState
): ApertureSettings | undefined {
  if (!isApertureMaskDraftValid(draft)) {
    return undefined;
  }

  return {
    shape: draft.shape,
    rotationDegrees: draft.shape === 'circle' ? 0 : draft.rotationDegrees,
    centralObstructionShape:
      draft.centralObstructionRatio > 0 ? draft.centralObstructionShape : 'circle',
    centralObstructionRotationDegrees:
      draft.centralObstructionRatio > 0 && draft.centralObstructionShape !== 'circle'
        ? draft.centralObstructionRotationDegrees
        : 0,
    centralObstructionRatio: draft.centralObstructionRatio,
    spiderVaneCount: draft.spiderVaneCount,
    spiderVaneWidthRatio: draft.spiderVaneWidthRatio,
    spiderVaneRotationDegrees: draft.spiderVaneRotationDegrees,
    gaussianApodizationEnabled: draft.gaussianApodizationEnabled,
    gaussianApodizationSigmaRatio: draft.gaussianApodizationSigmaRatio
  };
}

export function formatApertureSummary(settings: ApertureSettings, t?: TFunction): string {
  const obstructionPercent = settings.centralObstructionRatio * 100;
  const obstructionLabel =
    settings.centralObstructionRatio > 0
      ? ` ${formatShapeLabel(settings.centralObstructionShape, t).toLowerCase()}`
      : '';
  const formattedObstructionPercent = obstructionPercent.toLocaleString(undefined, {
    maximumFractionDigits: 1
  });
  const maskSummary = t
    ? t('apertureMask.summaryObstruction', {
        shape: formatShapeLabel(settings.shape, t),
        percent: formattedObstructionPercent,
        obstructionLabel
      })
    : `${formatShapeLabel(settings.shape)}, ${formattedObstructionPercent}%${obstructionLabel} obstruction`;
  const effects = [maskSummary];
  if (settings.spiderVaneCount > 0 && settings.spiderVaneWidthRatio > 0) {
    const rotationDegrees = Math.round(settings.spiderVaneRotationDegrees);
    const width = formatRatioValue(settings.spiderVaneWidthRatio);
    effects.push(
      t
        ? t('apertureMask.summarySpiderVane', {
            count: settings.spiderVaneCount,
            rotationDegrees,
            width
          })
        : `${settings.spiderVaneCount}-vane spider rotated ${rotationDegrees} deg, each vane ${width}D wide`
    );
  }
  if (!settings.gaussianApodizationEnabled) {
    return effects.join(', ');
  }

  const sigma = formatRatioValue(settings.gaussianApodizationSigmaRatio);
  effects.push(
    t
      ? t('apertureMask.summaryGaussianApodization', { sigma })
      : `Gaussian apodization with ${sigma}D sigma`
  );
  return effects.join(', ');
}

export function formatRatioValue(value: number): string {
  const roundedValue = roundRatioValue(value);
  if (roundedValue === 0) {
    return '0';
  }

  return roundedValue.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function isApertureMaskDraftValid(draft: ApertureMaskDraftState): boolean {
  return (
    isApertureRotationValid(draft) &&
    isObstructionRatioValid(draft.centralObstructionRatio) &&
    isObstructionRotationValid(draft) &&
    isSpiderVaneCountValid(draft.spiderVaneCount) &&
    isSpiderVaneWidthRatioValid(draft.spiderVaneWidthRatio) &&
    isRotationDegreesValid(draft.spiderVaneRotationDegrees) &&
    isGaussianSigmaRatioValid(draft)
  );
}

function isApertureRotationValid(draft: ApertureMaskDraftState): boolean {
  return draft.shape === 'circle' || isRotationDegreesValid(draft.rotationDegrees);
}

function isObstructionRatioValid(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value < 1;
}

function isObstructionRotationValid(draft: ApertureMaskDraftState): boolean {
  return (
    !isObstructionRatioValid(draft.centralObstructionRatio) ||
    draft.centralObstructionRatio === 0 ||
    draft.centralObstructionShape === 'circle' ||
    isRotationDegreesValid(draft.centralObstructionRotationDegrees)
  );
}

function isSpiderVaneCountValid(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value >= 0 && value <= 12;
}

function isSpiderVaneWidthRatioValid(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 0.25;
}

function isGaussianSigmaRatioValid(draft: ApertureMaskDraftState): boolean {
  return (
    !draft.gaussianApodizationEnabled ||
    (Number.isFinite(draft.gaussianApodizationSigmaRatio) &&
      draft.gaussianApodizationSigmaRatio >= 0.05 &&
      draft.gaussianApodizationSigmaRatio <= 1)
  );
}

function isRotationDegreesValid(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 360;
}

function isRatioText(value: string) {
  return value === '' || /^(?:\d+\.?\d*|\.\d+)$/.test(value);
}

function roundRatioValue(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatShapeLabel(shape: ApertureShape, t?: TFunction): string {
  const option = apertureShapeOptions.find((nextOption) => nextOption.value === shape);
  if (!option) {
    return shape;
  }

  return t ? t(option.labelKey) : option.label;
}
