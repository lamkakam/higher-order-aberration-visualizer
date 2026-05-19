import type { SupportedTargetId, ZernikeCoefficientKey } from '../workers/types';
import type { TFunction } from 'i18next';

export const targetOptions = [
  {
    id: 'logmar_chart',
    label: 'Eye Chart (logMAR)'
  },
  {
    id: 'snellen_e_20_20',
    label: 'Snellen Chart Letter E on 20/20'
  },
  {
    id: 'jupiter',
    label: 'Jupiter (angular diameter 50 arcsecond)'
  },
  {
    id: 'point_source',
    label: 'Point Source (Airy Disc)'
  },
  {
    id: 'siemensstar',
    label: 'Siemens Star'
  },
  {
    id: 'slantededge',
    label: 'Slanted Edge'
  },
  {
    id: 'tiltedsquare',
    label: 'Tilted Square'
  }
] as const satisfies readonly {
  readonly id: SupportedTargetId;
  readonly label: string;
}[];

export const supplementalDescriptions: Partial<Record<SupportedTargetId, string>> = {
  logmar_chart:
    'The PSF chart may show a clear intensity cutoff around the central region. This limit is intentional: it keeps chart generation responsive while reducing memory use and computational cost, without changing the underlying optical simulation.'
} as const;

export interface ZernikeTerm {
  readonly key: ZernikeCoefficientKey;
  readonly n: number;
  readonly m: number;
  readonly label: string;
}

export const zernikeTerms = [
  { key: '2,-2', n: 2, m: -2, label: 'Astigmatism (Oblique)' },
  { key: '2,0', n: 2, m: 0, label: 'Defocus' },
  { key: '2,2', n: 2, m: 2, label: 'Astigmatism (Vertical)' },
  { key: '3,-3', n: 3, m: -3, label: 'Trefoil (Vertical)' },
  { key: '3,-1', n: 3, m: -1, label: 'Coma (Vertical)' },
  { key: '3,1', n: 3, m: 1, label: 'Coma (Horizontal)' },
  { key: '3,3', n: 3, m: 3, label: 'Trefoil (Oblique)' },
  { key: '4,-4', n: 4, m: -4, label: 'Quadrafoil (Oblique)' },
  { key: '4,-2', n: 4, m: -2, label: 'Secondary Astigmatism (Oblique)' },
  { key: '4,0', n: 4, m: 0, label: 'Primary Spherical Aberration' },
  { key: '4,2', n: 4, m: 2, label: 'Secondary Astigmatism (Vertical)' },
  { key: '4,4', n: 4, m: 4, label: 'Quadrafoil (Vertical)' },
  { key: '5,-5', n: 5, m: -5, label: 'Pentafoil (Vertical)' },
  { key: '5,-3', n: 5, m: -3, label: 'Secondary Trefoil (Vertical)' },
  { key: '5,-1', n: 5, m: -1, label: 'Secondary Coma (Vertical)' },
  { key: '5,1', n: 5, m: 1, label: 'Secondary Coma (Horizontal)' },
  { key: '5,3', n: 5, m: 3, label: 'Secondary Trefoil (Oblique)' },
  { key: '5,5', n: 5, m: 5, label: 'Pentafoil (Oblique)' },
  { key: '6,-6', n: 6, m: -6, label: 'Hexafoil (Oblique)' },
  { key: '6,-4', n: 6, m: -4, label: 'Secondary Quadrafoil (Oblique)' },
  { key: '6,-2', n: 6, m: -2, label: 'Tertiary Astigmatism (Oblique)' },
  { key: '6,0', n: 6, m: 0, label: 'Secondary Spherical Aberration' },
  { key: '6,2', n: 6, m: 2, label: 'Tertiary Astigmatism (Vertical)' },
  { key: '6,4', n: 6, m: 4, label: 'Secondary Quadrafoil (Vertical)' },
  { key: '6,6', n: 6, m: 6, label: 'Hexafoil (Vertical)' }
] as const satisfies readonly ZernikeTerm[];

export const zernikeCoefficientMin = -5;
export const zernikeCoefficientMax = 5;
export const zernikeCoefficientStep = 0.05;
export const wavelengthNm = 550;

export function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

export function wavesToMicrons(waves: number, wavelengthNm: number): number {
  return (waves * wavelengthNm) / 1000;
}

export function micronsToWaves(microns: number, wavelengthNm: number): number {
  return microns / (wavelengthNm / 1000);
}

export function computeRmsWavefrontError(
  coefficients: Record<ZernikeCoefficientKey, number>
): number {
  return Math.sqrt(
    Object.values(coefficients).reduce((sum, coefficient) => sum + coefficient ** 2, 0)
  );
}

export function approximateStrehlRatio(
  coefficients: Record<ZernikeCoefficientKey, number>
): number {
  const rmsWaves = computeRmsWavefrontError(coefficients);

  return Math.exp(-((2 * Math.PI * rmsWaves) ** 2));
}

export function formatApproximateStrehlRatio(
  coefficients: Record<ZernikeCoefficientKey, number>,
  t?: TFunction
): string {
  const value = (approximateStrehlRatio(coefficients) * 100).toFixed(1);

  return t ? t('aberrations.approxStrehlValue', { value }) : `Approx. Strehl Ratio: ${value}%`;
}

export function createDefaultZernikeCoefficients(): Record<ZernikeCoefficientKey, number> {
  return Object.fromEntries(zernikeTerms.map((term) => [term.key, 0])) as Record<
    ZernikeCoefficientKey,
    number
  >;
}
