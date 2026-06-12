import { useEffect } from 'react';
import type { ZernikeCoefficientKey } from '../../../types/domain';
import type { DisplayMode } from '../../SettingsDrawer';
import {
  zernikeCoefficientMax,
  zernikeCoefficientMin,
  zernikeTerms
} from '../../lib/simulationConfig';
import { spectralWavelengths, type SpectralWavelength } from '../lib/defaults';

type ZernikeCoefficientPatch = Partial<Record<ZernikeCoefficientKey, number>>;

interface BasicZernikeToolInput {
  readonly coefficients: ZernikeCoefficientPatch;
}

interface AdvancedZernikeToolInput extends BasicZernikeToolInput {
  readonly wavelengthNm: SpectralWavelength;
}

interface ZernikeToolResult {
  readonly appliedKeys: readonly ZernikeCoefficientKey[];
  readonly wavelengthNm: SpectralWavelength;
}

interface UseZernikeWebMcpToolsOptions {
  readonly displayMode: DisplayMode;
  readonly patchZernikeCoefficientsForWavelength: (
    wavelength: SpectralWavelength,
    coefficients: ZernikeCoefficientPatch
  ) => void;
}

const editableZernikeKeys = new Set<ZernikeCoefficientKey>(
  zernikeTerms.map((term) => term.key)
);
const supportedWavelengths = new Set<SpectralWavelength>(spectralWavelengths);

export function useZernikeWebMcpTools({
  displayMode,
  patchZernikeCoefficientsForWavelength
}: UseZernikeWebMcpToolsOptions) {
  useEffect(() => {
    const modelContext = document.modelContext;

    if (modelContext === undefined) {
      return undefined;
    }

    const abortController = new AbortController();

    if (displayMode === 'advanced') {
      modelContext.registerTool(
        {
          name: 'set-advanced-zernike-coefficients',
          description: 'Patch editable Zernike coefficients for an explicit spectral wavelength.',
          inputSchema: {
            type: 'object',
            required: ['wavelengthNm', 'coefficients'],
            properties: {
              wavelengthNm: {
                enum: spectralWavelengths
              },
              coefficients: {
                type: 'object',
                additionalProperties: {
                  type: 'number',
                  minimum: zernikeCoefficientMin,
                  maximum: zernikeCoefficientMax
                }
              }
            }
          },
          execute(input: AdvancedZernikeToolInput): ZernikeToolResult {
            const validatedInput = validateAdvancedInput(input);
            patchZernikeCoefficientsForWavelength(
              validatedInput.wavelengthNm,
              validatedInput.coefficients
            );

            return {
              appliedKeys: Object.keys(validatedInput.coefficients) as ZernikeCoefficientKey[],
              wavelengthNm: validatedInput.wavelengthNm
            };
          }
        },
        { signal: abortController.signal }
      );
    } else {
      modelContext.registerTool(
        {
          name: 'set-basic-zernike-coefficients',
          description: 'Patch editable Zernike coefficients for the shared 550 nm wavelength.',
          inputSchema: {
            type: 'object',
            required: ['coefficients'],
            properties: {
              coefficients: {
                type: 'object',
                additionalProperties: {
                  type: 'number',
                  minimum: zernikeCoefficientMin,
                  maximum: zernikeCoefficientMax
                }
              }
            }
          },
          execute(input: BasicZernikeToolInput): ZernikeToolResult {
            const coefficients = validateCoefficientPatch(input.coefficients);
            patchZernikeCoefficientsForWavelength(550, coefficients);

            return {
              appliedKeys: Object.keys(coefficients) as ZernikeCoefficientKey[],
              wavelengthNm: 550
            };
          }
        },
        { signal: abortController.signal }
      );
    }

    return () => {
      abortController.abort();
    };
  }, [displayMode, patchZernikeCoefficientsForWavelength]);
}

function validateAdvancedInput(input: AdvancedZernikeToolInput): AdvancedZernikeToolInput {
  if (!supportedWavelengths.has(input.wavelengthNm)) {
    throw new Error('wavelengthNm must be one of the supported spectral wavelengths.');
  }

  return {
    wavelengthNm: input.wavelengthNm,
    coefficients: validateCoefficientPatch(input.coefficients)
  };
}

function validateCoefficientPatch(coefficients: ZernikeCoefficientPatch): ZernikeCoefficientPatch {
  if (
    coefficients === undefined ||
    coefficients === null ||
    typeof coefficients !== 'object' ||
    Array.isArray(coefficients)
  ) {
    throw new Error('coefficients must be an object.');
  }

  for (const [key, value] of Object.entries(coefficients)) {
    if (!editableZernikeKeys.has(key as ZernikeCoefficientKey)) {
      throw new Error(`Unsupported Zernike coefficient key: ${key}`);
    }

    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < zernikeCoefficientMin ||
      value > zernikeCoefficientMax
    ) {
      throw new Error(
        `Zernike coefficient ${key} must be a finite number between ${zernikeCoefficientMin} and ${zernikeCoefficientMax}.`
      );
    }
  }

  return coefficients;
}
