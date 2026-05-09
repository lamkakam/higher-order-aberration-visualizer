import type { SupportedTargetId, ZernikeCoefficientKey } from '../workers/types';

export const targetOptions = [
  {
    id: 'snellen_e_20_20',
    label: 'Snellen Chart Letter E on 20/20',
    description:
      'An eye-chart letter E from the 20/20 (6/6) line, used as a familiar vision-test target.'
  },
  {
    id: 'logmar_chart',
    label: 'LogMAR Chart',
    description: 'The first six lines of an eye chart, with letters arranged in rows.'
  },
  {
    id: 'jupiter_502nm',
    label: 'Jupiter (HST 502 nm, 50 arcsec)',
    description: 'A telescope-style picture of Jupiter used to see how fine details are softened.'
  },
  {
    id: 'point_source',
    label: 'Point Source (Airy Disc)',
    description: 'A single tiny bright point, useful for showing how a perfect dot spreads out.'
  },
  {
    id: 'siemensstar',
    label: 'Siemens Star',
    description:
      'A circular pattern of black-and-white spokes, useful for showing where fine details become blurred.'
  },
  {
    id: 'slantededge',
    label: 'Slanted Edge',
    description: 'A tilted black-and-white edge used to show how crisp an edge looks.'
  },
  {
    id: 'tiltedsquare',
    label: 'Tilted Square',
    description: 'A rotated square used to show how corners and edges change.'
  }
] as const satisfies readonly {
  readonly id: SupportedTargetId;
  readonly label: string;
  readonly description: string;
}[];

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

export const zernikeCoefficientMin = -2;
export const zernikeCoefficientMax = 2;
export const zernikeCoefficientStep = 0.05;

export function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

export function createDefaultZernikeCoefficients(): Record<ZernikeCoefficientKey, number> {
  return Object.fromEntries(zernikeTerms.map((term) => [term.key, 0])) as Record<
    ZernikeCoefficientKey,
    number
  >;
}
