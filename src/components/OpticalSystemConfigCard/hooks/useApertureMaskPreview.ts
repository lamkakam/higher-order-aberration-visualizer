import { useEffect, useState } from 'react';
import type { ApertureMaskResult, ApertureSettings } from '../../../workers/types';

interface ApertureMaskPreview {
  readonly preview: ApertureMaskResult | undefined;
  readonly previewError: string | undefined;
  readonly isPreviewLoading: boolean;
}

export function useApertureMaskPreview(
  draftSettings: ApertureSettings | undefined,
  onRenderApertureMask: (value: ApertureSettings) => Promise<ApertureMaskResult>
): ApertureMaskPreview {
  const [preview, setPreview] = useState<ApertureMaskResult | undefined>(undefined);
  const [previewError, setPreviewError] = useState<string | undefined>(undefined);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  useEffect(() => {
    if (!draftSettings) {
      return;
    }

    let cancelled = false;
    setIsPreviewLoading(true);
    setPreviewError(undefined);
    onRenderApertureMask(draftSettings)
      .then((nextPreview) => {
        if (!cancelled) {
          setPreview(nextPreview);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setPreview(undefined);
          setPreviewError(error instanceof Error ? error.message : 'Aperture preview failed');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [draftSettings, onRenderApertureMask]);

  return { preview, previewError, isPreviewLoading };
}
