import { useEffect, useState } from 'react';
import type { ApertureMaskResult, ApertureSettings } from '../../../workers/types';

interface ApertureMaskPreview {
  readonly preview: ApertureMaskResult | undefined;
  readonly previewError: string | undefined;
  readonly isPreviewLoading: boolean;
}

type SettledApertureMaskPreview =
  | {
      readonly settings: ApertureSettings;
      readonly preview: ApertureMaskResult;
      readonly previewError?: undefined;
    }
  | {
      readonly settings: ApertureSettings;
      readonly preview?: undefined;
      readonly previewError: string;
    };

export function useApertureMaskPreview(
  draftSettings: ApertureSettings | undefined,
  onRenderApertureMask: (value: ApertureSettings) => Promise<ApertureMaskResult>,
  fallbackErrorMessage = 'Aperture preview failed'
): ApertureMaskPreview {
  const [settledPreview, setSettledPreview] = useState<SettledApertureMaskPreview | undefined>(
    undefined
  );

  useEffect(() => {
    if (!draftSettings) {
      return;
    }

    let ignore = false;
    onRenderApertureMask(draftSettings)
      .then((nextPreview) => {
        if (!ignore) {
          setSettledPreview({
            settings: draftSettings,
            preview: nextPreview
          });
        }
      })
      .catch((error) => {
        if (!ignore) {
          setSettledPreview({
            settings: draftSettings,
            previewError: error instanceof Error ? error.message : fallbackErrorMessage
          });
        }
      });

    return () => {
      ignore = true;
    };
  }, [draftSettings, fallbackErrorMessage, onRenderApertureMask]);

  const currentSettledPreview =
    settledPreview?.settings === draftSettings ? settledPreview : undefined;
  const preview = currentSettledPreview?.preview;
  const previewError = currentSettledPreview?.previewError;
  const isPreviewLoading = Boolean(draftSettings && settledPreview?.settings !== draftSettings);

  return { preview, previewError, isPreviewLoading };
}
