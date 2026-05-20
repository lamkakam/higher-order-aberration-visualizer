import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkerClient } from '../../../hooks/useWorkerClient';
import type { WorkerClient } from '../../../workers/client';
import type {
  ApertureSettings,
  SpectralMode,
  SupportedTargetId,
  WavefrontLegendUnit,
  ZernikeCoefficientKey
} from '../../../types/domain';
import type { ConvolvedImageResult } from '../../../workers/types';
import type { DisplayMode } from '../../SettingsDrawer';
import {
  computeTimeoutMs,
  createDefaultZernikeCoefficientsByWavelength,
  debounceMs,
  defaultApertureDiameterMm,
  defaultApertureSettings,
  defaultTargetId,
  spectralWavelengths,
  type SpectralWavelength
} from '../lib/defaults';
import { createDefaultZernikeCoefficients } from '../../simulationConfig';

interface UseSimulationStateOptions {
  readonly displayMode: DisplayMode;
  readonly workerClient?: WorkerClient;
}

export function useSimulationState({
  displayMode,
  workerClient
}: UseSimulationStateOptions) {
  const { client, diagnostics, setDiagnostics } = useWorkerClient(workerClient);
  const { t } = useTranslation();
  const [showScaleBar, setShowScaleBar] = useState(false);
  const [spectralMode, setSpectralMode] = useState<SpectralMode>('monochromatic');
  const [selectedWavelength, setSelectedWavelength] = useState<SpectralWavelength>(550);
  const [syncWavelengthCoefficients, setSyncWavelengthCoefficients] = useState(true);
  const [wavefrontLegendUnit, setWavefrontLegendUnit] =
    useState<WavefrontLegendUnit>('wave');
  const [apertureDiameterMm, setApertureDiameterMm] = useState(defaultApertureDiameterMm);
  const [apertureSettings, setApertureSettings] = useState(defaultApertureSettings);
  const [targetId, setTargetId] = useState<SupportedTargetId>(defaultTargetId);
  const [zernikeCoefficientsByWavelength, setZernikeCoefficientsByWavelength] = useState(
    createDefaultZernikeCoefficientsByWavelength
  );
  const [result, setResult] = useState<ConvolvedImageResult | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const isWorkerInitializing = diagnostics.status === 'initializing';
  const isImageLoading = isLoading && !isWorkerInitializing;
  const zernikeCoefficients = zernikeCoefficientsByWavelength[550];
  const effectiveSpectralMode: SpectralMode =
    displayMode === 'advanced' ? spectralMode : 'monochromatic';
  const isPolychromatic = effectiveSpectralMode === 'polychromatic';
  const simulationWavelengths = useMemo(
    () => (isPolychromatic ? spectralWavelengths : ([550] as const)),
    [isPolychromatic]
  );
  const wavelengthWeights = useMemo(
    () => simulationWavelengths.map((wavelength) => [wavelength, 1] as const),
    [simulationWavelengths]
  );
  const simulationCoefficientsByWavelength = useMemo(
    () =>
      simulationWavelengths.map(
        (wavelength) => [wavelength, zernikeCoefficientsByWavelength[wavelength]] as const
      ),
    [simulationWavelengths, zernikeCoefficientsByWavelength]
  );
  const diagnosticWavelengthNm = isPolychromatic ? selectedWavelength : 550;

  useEffect(() => {
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      setIsLoading(true);
      setError(undefined);

      withTimeout(
        client.api.computeConvolvedImage({
          apertureSettings,
          apertureDiameterMm,
          diagnosticWavelengthNm,
          showScaleBar,
          spectralMode: effectiveSpectralMode,
          targetId,
          wavelengthWeights,
          wavefrontLegendUnit,
          zernikeCoefficientsByWavelength: simulationCoefficientsByWavelength
        }),
        computeTimeoutMs,
        t('status.computeTimedOut')
      )
        .then((nextResult) => {
          if (!cancelled) {
            setResult(nextResult);
            setDiagnostics(nextResult.diagnostics);
            setError(undefined);
          }
        })
        .catch((caughtError) => {
          if (!cancelled) {
            setError(caughtError instanceof Error ? caughtError.message : t('status.simulationFailed'));
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoading(false);
          }
        });
    }, debounceMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    apertureDiameterMm,
    apertureSettings,
    client,
    diagnosticWavelengthNm,
    effectiveSpectralMode,
    showScaleBar,
    setDiagnostics,
    t,
    targetId,
    wavefrontLegendUnit,
    simulationCoefficientsByWavelength,
    wavelengthWeights
  ]);

  const updateZernikeCoefficient = useCallback(
    (wavelength: SpectralWavelength, key: ZernikeCoefficientKey, value: number) => {
      setZernikeCoefficientsByWavelength((currentValues) => {
        if (effectiveSpectralMode === 'polychromatic' && syncWavelengthCoefficients) {
          return {
            550: {
              ...currentValues[550],
              [key]: value
            },
            656: {
              ...currentValues[656],
              [key]: value
            },
            486: {
              ...currentValues[486],
              [key]: value
            }
          };
        }

        return {
          ...currentValues,
          [wavelength]: {
            ...currentValues[wavelength],
            [key]: value
          }
        };
      });
    },
    [effectiveSpectralMode, syncWavelengthCoefficients]
  );

  const resetZernikeCoefficients = useCallback((wavelength: SpectralWavelength) => {
    setZernikeCoefficientsByWavelength((currentValues) => ({
      ...currentValues,
      [wavelength]: createDefaultZernikeCoefficients()
    }));
  }, []);

  const resetAllZernikeCoefficientsByWavelength = useCallback(() => {
    setZernikeCoefficientsByWavelength(createDefaultZernikeCoefficientsByWavelength());
  }, []);

  const updateSpectralMode = useCallback((nextMode: SpectralMode) => {
    setSpectralMode(nextMode);
    if (nextMode === 'polychromatic') {
      setSelectedWavelength(550);
    }
  }, []);

  const renderApertureMask = useCallback(
    (nextApertureSettings: ApertureSettings) =>
      client.api.renderApertureMask(nextApertureSettings),
    [client]
  );

  return {
    apertureDiameterMm,
    apertureSettings,
    diagnostics,
    effectiveSpectralMode,
    error,
    isImageLoading,
    isPolychromatic,
    isWorkerInitializing,
    renderApertureMask,
    resetAllZernikeCoefficientsByWavelength,
    resetZernikeCoefficients,
    result,
    selectedWavelength,
    setApertureDiameterMm,
    setApertureSettings,
    setSelectedWavelength,
    setShowScaleBar,
    setSyncWavelengthCoefficients,
    setTargetId,
    setWavefrontLegendUnit,
    showScaleBar,
    simulationWavelengths,
    spectralMode,
    syncWavelengthCoefficients,
    targetId,
    updateSpectralMode,
    updateZernikeCoefficient,
    wavefrontLegendUnit,
    zernikeCoefficients,
    zernikeCoefficientsByWavelength
  };
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}
