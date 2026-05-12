import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ApertureMaskResult, ApertureSettings } from '../../../workers/types';
import { useApertureMaskPreview } from './useApertureMaskPreview';

const apertureSettings: ApertureSettings = {
  shape: 'circle',
  rotationDegrees: 0,
  centralObstructionShape: 'circle',
  centralObstructionRotationDegrees: 0,
  centralObstructionRatio: 0,
  spiderVaneCount: 0,
  spiderVaneWidthRatio: 0,
  spiderVaneRotationDegrees: 0,
  gaussianApodizationEnabled: false,
  gaussianApodizationSigmaRatio: 0.5
};

const previewResult: ApertureMaskResult = {
  imageUrl: 'data:image/png;base64,preview',
  diagnostics: {
    status: 'ready',
    message: 'Preview ready'
  }
};

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason?: unknown) => void = () => {};
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

describe('useApertureMaskPreview', () => {
  it('starts loading and stores successful preview result', async () => {
    const preview = deferred<ApertureMaskResult>();
    const onRenderApertureMask = vi.fn(() => preview.promise);
    const { result } = renderHook(() =>
      useApertureMaskPreview(apertureSettings, onRenderApertureMask)
    );

    await waitFor(() => expect(result.current.isPreviewLoading).toBe(true));

    await act(async () => {
      preview.resolve(previewResult);
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        preview: previewResult,
        previewError: undefined,
        isPreviewLoading: false
      });
    });
  });

  it('sets an Error message and clears preview when render fails', async () => {
    const onRenderApertureMask = vi.fn(async () => previewResult);
    const { result, rerender } = renderHook(
      ({ settings }) => useApertureMaskPreview(settings, onRenderApertureMask),
      { initialProps: { settings: apertureSettings } }
    );

    await waitFor(() => expect(result.current.preview).toBe(previewResult));

    onRenderApertureMask.mockRejectedValueOnce(new Error('Worker unavailable'));
    rerender({
      settings: {
        ...apertureSettings,
        spiderVaneCount: 4
      }
    });

    await waitFor(() => {
      expect(result.current.preview).toBeUndefined();
      expect(result.current.previewError).toBe('Worker unavailable');
      expect(result.current.isPreviewLoading).toBe(false);
    });
  });

  it('uses a fallback message for non-Error rejections', async () => {
    const onRenderApertureMask = vi.fn().mockRejectedValue('failed');
    const { result } = renderHook(() =>
      useApertureMaskPreview(apertureSettings, onRenderApertureMask)
    );

    await waitFor(() => {
      expect(result.current.preview).toBeUndefined();
      expect(result.current.previewError).toBe('Aperture preview failed');
      expect(result.current.isPreviewLoading).toBe(false);
    });
  });

  it('ignores stale promise resolution after settings change', async () => {
    const firstPreview = deferred<ApertureMaskResult>();
    const secondPreview = deferred<ApertureMaskResult>();
    const nextPreview = {
      ...previewResult,
      imageUrl: 'data:image/png;base64,next-preview'
    };
    const onRenderApertureMask = vi
      .fn<() => Promise<ApertureMaskResult>>()
      .mockReturnValueOnce(firstPreview.promise)
      .mockReturnValueOnce(secondPreview.promise);
    const { result, rerender } = renderHook(
      ({ settings }) => useApertureMaskPreview(settings, onRenderApertureMask),
      { initialProps: { settings: apertureSettings } }
    );

    await waitFor(() => expect(result.current.isPreviewLoading).toBe(true));

    rerender({
      settings: {
        ...apertureSettings,
        spiderVaneCount: 4
      }
    });

    await act(async () => {
      firstPreview.resolve(previewResult);
    });

    expect(result.current.preview).toBeUndefined();

    await act(async () => {
      secondPreview.resolve(nextPreview);
    });

    await waitFor(() => {
      expect(result.current.preview).toBe(nextPreview);
      expect(result.current.isPreviewLoading).toBe(false);
    });
  });
});
