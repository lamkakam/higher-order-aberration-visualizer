import { useEffect } from 'react';
import type { ZernikeCoefficientKey } from '../../../types/domain';
import type { DisplayMode } from '../../SettingsDrawer';
import {
  zernikeCoefficientMax,
  zernikeCoefficientMin,
  zernikeTerms
} from '../../lib/simulationConfig';
import { spectralWavelengths, type SpectralWavelength } from '../lib/defaults';

type CoefficientUnit = 'wave' | 'micron';
type ZernikeCoefficientPatch = Partial<Record<ZernikeCoefficientKey, number>>;
type ZernikeCoefficientPatchesByWavelength = Partial<
  Record<SpectralWavelength, ZernikeCoefficientPatch>
>;

interface BasicZernikeToolInput {
  readonly apertureDiameterMm: number;
  readonly coefficientUnit: CoefficientUnit;
  readonly coefficients: ZernikeCoefficientPatch;
}

interface AdvancedZernikeToolInput {
  readonly apertureDiameterMm: number;
  readonly coefficientUnit: CoefficientUnit;
  readonly coefficientsByWavelength: ZernikeCoefficientPatchesByWavelength;
}

interface ZernikeWebMcpUpdate {
  readonly apertureDiameterMm: number;
  readonly coefficientsByWavelength: ZernikeCoefficientPatchesByWavelength;
  readonly enablePolychromatic: boolean;
}

interface UseZernikeWebMcpToolsOptions {
  readonly applyZernikeWebMcpUpdate: (update: ZernikeWebMcpUpdate) => void;
  readonly displayMode: DisplayMode;
}

const apertureDiameterMinimumMm = 0.5;
const editableZernikeKeys = new Set<ZernikeCoefficientKey>(
  zernikeTerms.map((term) => term.key)
);
const supportedWavelengthKeys = new Set(spectralWavelengths.map(String));
const zernikeCoefficientValueSchema = {
  type: 'number',
  minimum: zernikeCoefficientMin,
  maximum: zernikeCoefficientMax
} as const;
const apertureDiameterSchema = {
  type: 'number',
  minimum: apertureDiameterMinimumMm
} as const;
const coefficientUnitSchema = {
  type: 'string',
  enum: ['wave', 'micron']
} as const;

function createZernikeCoefficientPatchSchema() {
  return {
    type: 'object',
    minProperties: 1,
    properties: Object.fromEntries(
      zernikeTerms.map((term) => [term.key, zernikeCoefficientValueSchema])
    ),
    additionalProperties: false
  };
}

function createCoefficientsByWavelengthSchema() {
  return {
    type: 'object',
    minProperties: 1,
    properties: Object.fromEntries(
      spectralWavelengths.map((wavelength) => [
        String(wavelength),
        createZernikeCoefficientPatchSchema()
      ])
    ),
    additionalProperties: false
  };
}

export function useZernikeWebMcpTools({
  applyZernikeWebMcpUpdate,
  displayMode
}: UseZernikeWebMcpToolsOptions) {
  useEffect(() => {
    const modelContext = document.modelContext ?? navigator.modelContext;

    if (modelContext === undefined) {
      return undefined;
    }

    const abortController = new AbortController();
    let registration: Promise<void>;
    let toolName: string;

    if (displayMode === 'advanced') {
      toolName = 'set-advanced-zernike-coefficients';
      registration = modelContext.registerTool(
        {
          name: toolName,
          description:
            'Patch editable Zernike coefficients for one or more spectral wavelengths.',
          inputSchema: {
            type: 'object',
            required: ['apertureDiameterMm', 'coefficientUnit', 'coefficientsByWavelength'],
            properties: {
              apertureDiameterMm: apertureDiameterSchema,
              coefficientUnit: coefficientUnitSchema,
              coefficientsByWavelength: createCoefficientsByWavelengthSchema()
            },
            additionalProperties: false
          },
          execute(input: unknown) {
            const validatedInput = validateAdvancedInput(input);
            applyZernikeWebMcpUpdate({
              apertureDiameterMm: validatedInput.apertureDiameterMm,
              coefficientsByWavelength: validatedInput.coefficientsByWavelength,
              enablePolychromatic:
                validatedInput.coefficientsByWavelength[656] !== undefined ||
                validatedInput.coefficientsByWavelength[486] !== undefined
            });

            return {
              appliedKeysByWavelength: Object.fromEntries(
                Object.entries(validatedInput.coefficientsByWavelength).map(
                  ([wavelength, coefficients]) => [wavelength, Object.keys(coefficients)]
                )
              ) as Partial<Record<SpectralWavelength, readonly ZernikeCoefficientKey[]>>
            };
          }
        },
        { signal: abortController.signal }
      );
    } else {
      toolName = 'set-basic-zernike-coefficients';
      registration = modelContext.registerTool(
        {
          name: toolName,
          description:
            'Patch editable Zernike coefficients for the shared 550 nm wavelength.',
          inputSchema: {
            type: 'object',
            required: ['apertureDiameterMm', 'coefficientUnit', 'coefficients'],
            properties: {
              apertureDiameterMm: apertureDiameterSchema,
              coefficientUnit: coefficientUnitSchema,
              coefficients: createZernikeCoefficientPatchSchema()
            },
            additionalProperties: false
          },
          execute(input: unknown) {
            const validatedInput = validateBasicInput(input);
            applyZernikeWebMcpUpdate({
              apertureDiameterMm: validatedInput.apertureDiameterMm,
              coefficientsByWavelength: { 550: validatedInput.coefficients },
              enablePolychromatic: false
            });

            return {
              appliedKeys: Object.keys(validatedInput.coefficients) as ZernikeCoefficientKey[],
              wavelengthNm: 550 as const
            };
          }
        },
        { signal: abortController.signal }
      );
    }

    void registration.catch((error: unknown) => {
      if (
        abortController.signal.aborted &&
        error instanceof DOMException &&
        error.name === 'AbortError'
      ) {
        return;
      }

      console.error(`Failed to register WebMCP tool: ${toolName}`, error);
    });

    return () => {
      abortController.abort();
    };
  }, [applyZernikeWebMcpUpdate, displayMode]);
}

function validateBasicInput(input: unknown): BasicZernikeToolInput {
  const record = validateObject(input, 'input');
  validateExactKeys(record, ['apertureDiameterMm', 'coefficientUnit', 'coefficients']);
  const apertureDiameterMm = validateApertureDiameter(record.apertureDiameterMm);
  const coefficientUnit = validateCoefficientUnit(record.coefficientUnit);

  return {
    apertureDiameterMm,
    coefficientUnit,
    coefficients: validateAndConvertCoefficientPatch(record.coefficients, coefficientUnit, 550)
  };
}

function validateAdvancedInput(input: unknown): AdvancedZernikeToolInput {
  const record = validateObject(input, 'input');
  validateExactKeys(record, [
    'apertureDiameterMm',
    'coefficientUnit',
    'coefficientsByWavelength'
  ]);
  const apertureDiameterMm = validateApertureDiameter(record.apertureDiameterMm);
  const coefficientUnit = validateCoefficientUnit(record.coefficientUnit);
  const wavelengthMap = validateObject(
    record.coefficientsByWavelength,
    'coefficientsByWavelength'
  );

  if (Object.keys(wavelengthMap).length === 0) {
    throw new Error('coefficientsByWavelength must contain at least one wavelength patch.');
  }

  const coefficientsByWavelength: ZernikeCoefficientPatchesByWavelength = {};
  for (const [wavelengthKey, coefficients] of Object.entries(wavelengthMap)) {
    if (!supportedWavelengthKeys.has(wavelengthKey)) {
      throw new Error(`Unsupported spectral wavelength: ${wavelengthKey}`);
    }

    const wavelength = Number(wavelengthKey) as SpectralWavelength;
    coefficientsByWavelength[wavelength] = validateAndConvertCoefficientPatch(
      coefficients,
      coefficientUnit,
      wavelength
    );
  }

  return { apertureDiameterMm, coefficientUnit, coefficientsByWavelength };
}

function validateAndConvertCoefficientPatch(
  input: unknown,
  coefficientUnit: CoefficientUnit,
  wavelengthNm: SpectralWavelength
): ZernikeCoefficientPatch {
  const coefficients = validateObject(input, `coefficients for ${wavelengthNm} nm`);

  if (Object.keys(coefficients).length === 0) {
    throw new Error(`coefficients for ${wavelengthNm} nm must contain at least one patch value.`);
  }

  const convertedCoefficients: ZernikeCoefficientPatch = {};
  for (const [key, value] of Object.entries(coefficients)) {
    if (!editableZernikeKeys.has(key as ZernikeCoefficientKey)) {
      throw new Error(`Unsupported Zernike coefficient key: ${key}`);
    }

    const waveValue =
      typeof value === 'number' && coefficientUnit === 'micron'
        ? value / (wavelengthNm / 1000)
        : value;
    if (
      typeof waveValue !== 'number' ||
      !Number.isFinite(waveValue) ||
      waveValue < zernikeCoefficientMin ||
      waveValue > zernikeCoefficientMax
    ) {
      throw new Error(
        `Zernike coefficient ${key} must convert to a finite wave value between ${zernikeCoefficientMin} and ${zernikeCoefficientMax}.`
      );
    }

    convertedCoefficients[key as ZernikeCoefficientKey] = waveValue;
  }

  return convertedCoefficients;
}

function validateApertureDiameter(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < apertureDiameterMinimumMm
  ) {
    throw new Error(
      `apertureDiameterMm must be a finite number of at least ${apertureDiameterMinimumMm}.`
    );
  }

  return value;
}

function validateCoefficientUnit(value: unknown): CoefficientUnit {
  if (value !== 'wave' && value !== 'micron') {
    throw new Error('coefficientUnit must be either wave or micron.');
  }

  return value;
}

function validateObject(value: unknown, name: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function validateExactKeys(record: Record<string, unknown>, expectedKeys: readonly string[]) {
  const expectedKeySet = new Set(expectedKeys);
  for (const key of Object.keys(record)) {
    if (!expectedKeySet.has(key)) {
      throw new Error(`Unsupported input property: ${key}`);
    }
  }

  for (const key of expectedKeys) {
    if (!(key in record)) {
      throw new Error(`Missing required input property: ${key}`);
    }
  }
}
