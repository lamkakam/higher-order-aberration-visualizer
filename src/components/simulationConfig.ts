import type { SupportedTargetId, ZernikeCoefficientKey } from '../workers/types';

export const targetOptions = [
  {
    id: 'snellen_e_20_20',
    label: 'Snellen Chart Letter E on 20/20'
  },
  {
    id: 'logmar_chart',
    label: 'LogMAR Chart'
  },
  {
    id: 'jupiter_502nm',
    label: 'Jupiter (HST 502 nm, 50 arcsec)'
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

export interface ZernikeTerm {
  readonly key: ZernikeCoefficientKey;
  readonly n: number;
  readonly m: number;
  readonly label: string;
}

export const zernikeTerms = [
  { key: '2,-2', n: 2, m: -2, label: 'Astigmatism 45' },
  { key: '2,0', n: 2, m: 0, label: 'Defocus' },
  { key: '2,2', n: 2, m: 2, label: 'Astigmatism 0' },
  { key: '3,-3', n: 3, m: -3, label: 'Trefoil Y' },
  { key: '3,-1', n: 3, m: -1, label: 'Coma Y' },
  { key: '3,1', n: 3, m: 1, label: 'Coma X' },
  { key: '3,3', n: 3, m: 3, label: 'Trefoil X' },
  { key: '4,-4', n: 4, m: -4, label: 'Quadrafoil Y' },
  { key: '4,-2', n: 4, m: -2, label: 'Secondary Astigmatism 45' },
  { key: '4,0', n: 4, m: 0, label: 'Spherical' },
  { key: '4,2', n: 4, m: 2, label: 'Secondary Astigmatism 0' },
  { key: '4,4', n: 4, m: 4, label: 'Quadrafoil X' }
] as const satisfies readonly ZernikeTerm[];

export const zernikeCoefficientMin = -2;
export const zernikeCoefficientMax = 2;
export const zernikeCoefficientStep = 0.1;

export function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

export function createDefaultZernikeCoefficients(): Record<ZernikeCoefficientKey, number> {
  return Object.fromEntries(zernikeTerms.map((term) => [term.key, 0])) as Record<
    ZernikeCoefficientKey,
    number
  >;
}
