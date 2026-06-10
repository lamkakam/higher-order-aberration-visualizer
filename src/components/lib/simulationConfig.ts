import type { SupportedTargetId, ZernikeCoefficientKey } from '../../types/domain';
import type { TFunction } from 'i18next';

export const targetOptions = [
  {
    id: 'logmar_chart',
    label: 'Eye Chart (logMAR)'
  },
  {
    id: 'logmar_chart_inverted',
    label: 'Eye Chart (logMAR, Inverted Contrast)'
  },
  {
    id: 'snellen_e_20_20',
    label: 'Snellen Chart Letter E on 20/20'
  },
  {
    id: 'snellen_e_20_20_inverted',
    label: 'Snellen Chart Letter E on 20/20 (Inverted Contrast)'
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
    id: 'wide_point_source',
    label: 'Point Source (Airy Disc) for Star Test'
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
  readonly name: {
    readonly base:
      | 'astigmatism'
      | 'coma'
      | 'defocus'
      | 'hexafoil'
      | 'pentafoil'
      | 'quadrafoil'
      | 'sphericalAberration'
      | 'trefoil';
    readonly order?: 'primary' | 'secondary' | 'tertiary';
    readonly orientation?: 'horizontal' | 'oblique' | 'vertical';
  };
}

export const zernikeTerms = [
  { key: '2,-2', n: 2, m: -2, name: { base: 'astigmatism', orientation: 'oblique' } },
  { key: '2,0', n: 2, m: 0, name: { base: 'defocus' } },
  { key: '2,2', n: 2, m: 2, name: { base: 'astigmatism', orientation: 'vertical' } },
  { key: '3,-3', n: 3, m: -3, name: { base: 'trefoil', orientation: 'vertical' } },
  { key: '3,-1', n: 3, m: -1, name: { base: 'coma', orientation: 'vertical' } },
  { key: '3,1', n: 3, m: 1, name: { base: 'coma', orientation: 'horizontal' } },
  { key: '3,3', n: 3, m: 3, name: { base: 'trefoil', orientation: 'oblique' } },
  { key: '4,-4', n: 4, m: -4, name: { base: 'quadrafoil', orientation: 'oblique' } },
  {
    key: '4,-2',
    n: 4,
    m: -2,
    name: { base: 'astigmatism', order: 'secondary', orientation: 'oblique' }
  },
  { key: '4,0', n: 4, m: 0, name: { base: 'sphericalAberration', order: 'primary' } },
  {
    key: '4,2',
    n: 4,
    m: 2,
    name: { base: 'astigmatism', order: 'secondary', orientation: 'vertical' }
  },
  { key: '4,4', n: 4, m: 4, name: { base: 'quadrafoil', orientation: 'vertical' } },
  { key: '5,-5', n: 5, m: -5, name: { base: 'pentafoil', orientation: 'vertical' } },
  {
    key: '5,-3',
    n: 5,
    m: -3,
    name: { base: 'trefoil', order: 'secondary', orientation: 'vertical' }
  },
  {
    key: '5,-1',
    n: 5,
    m: -1,
    name: { base: 'coma', order: 'secondary', orientation: 'vertical' }
  },
  {
    key: '5,1',
    n: 5,
    m: 1,
    name: { base: 'coma', order: 'secondary', orientation: 'horizontal' }
  },
  {
    key: '5,3',
    n: 5,
    m: 3,
    name: { base: 'trefoil', order: 'secondary', orientation: 'oblique' }
  },
  { key: '5,5', n: 5, m: 5, name: { base: 'pentafoil', orientation: 'oblique' } },
  { key: '6,-6', n: 6, m: -6, name: { base: 'hexafoil', orientation: 'oblique' } },
  {
    key: '6,-4',
    n: 6,
    m: -4,
    name: { base: 'quadrafoil', order: 'secondary', orientation: 'oblique' }
  },
  {
    key: '6,-2',
    n: 6,
    m: -2,
    name: { base: 'astigmatism', order: 'tertiary', orientation: 'oblique' }
  },
  { key: '6,0', n: 6, m: 0, name: { base: 'sphericalAberration', order: 'secondary' } },
  {
    key: '6,2',
    n: 6,
    m: 2,
    name: { base: 'astigmatism', order: 'tertiary', orientation: 'vertical' }
  },
  {
    key: '6,4',
    n: 6,
    m: 4,
    name: { base: 'quadrafoil', order: 'secondary', orientation: 'vertical' }
  },
  { key: '6,6', n: 6, m: 6, name: { base: 'hexafoil', orientation: 'vertical' } }
] as const satisfies readonly ZernikeTerm[];

export const zernikeCoefficientMin = -5;
export const zernikeCoefficientMax = 5;
export const zernikeCoefficientStep = 0.001;
export const wavelengthNm = 550;

type ZernikePayloadByWavelength = readonly (readonly [
  number,
  Record<ZernikeCoefficientKey, number>
])[];

const atmosphericVarianceCoefficientsByZernikeKey: Record<ZernikeCoefficientKey, number> = {
  '1,-1': 0.448,
  '1,1': 0.448,
  '2,-2': 0.0232,
  '2,0': 0.023,
  '2,2': 0.0232,
  '3,-3': 0.00619,
  '3,-1': 0.00619,
  '3,1': 0.00619,
  '3,3': 0.00619,
  '4,-4': 0.00254,
  '4,-2': 0.00254,
  '4,0': 0.00254,
  '4,2': 0.00254,
  '4,4': 0.00254,
  '5,-5': 0.00129,
  '5,-3': 0.00129,
  '5,-1': 0.00129,
  '5,1': 0.00129,
  '5,3': 0.00129,
  '5,5': 0.00129,
  '6,-6': 0.00074,
  '6,-4': 0.00074,
  '6,-2': 0.00074,
  '6,0': 0.00074,
  '6,2': 0.00074,
  '6,4': 0.00074,
  '6,6': 0.00074
};

export function roundToThreeDecimals(value: number): number {
  return Math.round(value * 1000) / 1000;
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

export function calculateDOverR0FromFwhmSeeing({
  apertureDiameterMm,
  fwhmSeeingArcsec,
  wavelengthNm
}: {
  readonly apertureDiameterMm: number;
  readonly fwhmSeeingArcsec: number;
  readonly wavelengthNm: number;
}): number {
  if (fwhmSeeingArcsec <= 0) {
    return 0;
  }

  return (apertureDiameterMm * fwhmSeeingArcsec) / (0.20214 * wavelengthNm);
}

export function createFwhmSeeingZernikeSigmaPayload({
  apertureDiameterMm,
  fwhmSeeingArcsec,
  zernikeCoefficientsByWavelength
}: {
  readonly apertureDiameterMm: number;
  readonly fwhmSeeingArcsec: number;
  readonly zernikeCoefficientsByWavelength: ZernikePayloadByWavelength;
}): ZernikePayloadByWavelength {
  if (fwhmSeeingArcsec <= 0) {
    return zernikeCoefficientsByWavelength.map(
      ([wavelength]) => [wavelength, {} as Record<ZernikeCoefficientKey, number>] as const
    );
  }

  return zernikeCoefficientsByWavelength.map(([wavelength]) => {
    const dOverR0 = calculateDOverR0FromFwhmSeeing({
      apertureDiameterMm,
      fwhmSeeingArcsec,
      wavelengthNm: wavelength
    });
    const seeingSigmas = {} as Record<ZernikeCoefficientKey, number>;

    for (const key of Object.keys(
      atmosphericVarianceCoefficientsByZernikeKey
    ) as ZernikeCoefficientKey[]) {
      const varianceCoefficient = atmosphericVarianceCoefficientsByZernikeKey[key];
      const seeingSigma =
        (Math.sqrt(varianceCoefficient) / (2 * Math.PI)) * dOverR0 ** (5 / 6);
      seeingSigmas[key] = seeingSigma;
    }

    return [wavelength, seeingSigmas] as const;
  });
}
