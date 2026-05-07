import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from './App';
import { createMockWorkerClient } from './test/workerMock';
import type { ConvolvedImageInput, ConvolvedImageResult } from './workers/types';

afterEach(() => {
  vi.useRealTimers();
});

it('renders the header and settings drawer theme controls', async () => {
  const user = userEvent.setup();
  render(<App workerClient={createMockWorkerClient()} />);

  expect(screen.getByText('HOA Visualizer')).toBeInTheDocument();
  expect(screen.getByText('Optical Aberration Simulator')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Setting' }));

  expect(screen.getByText('Mode')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Light' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'System' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Dark' })).toBeInTheDocument();
  expect(screen.getByText('Display')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Basic' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Advanced' })).toBeInTheDocument();
});

it('renders default aperture and supported target options', async () => {
  const user = userEvent.setup();
  render(<App workerClient={createMockWorkerClient()} />);

  expect(screen.getByRole('heading', { name: 'Optical System Config' })).toBeInTheDocument();
  expect(screen.getByLabelText('Aperture Diameter (mm)')).toHaveValue('3');
  expect(screen.queryByText('Minimum value is 0.5.')).not.toBeInTheDocument();

  await user.click(screen.getByLabelText('Target'));

  expect(screen.getByRole('option', { name: 'Snellen Chart Letter E on 20/20' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'LogMAR Chart' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Jupiter (HST 502 nm, 50 arcsec)' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Point Source (Airy Disc)' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Siemens Star' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Slanted Edge' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Tilted Square' })).toBeInTheDocument();
});

it('shows zernike textbox values and resets changed values', async () => {
  const user = userEvent.setup();
  render(<App workerClient={createMockWorkerClient()} />);

  expect(screen.getByRole('heading', { name: 'Optical Aberrations (Zernike)' })).toBeInTheDocument();
  const sphericalCoefficient = screen.getByRole('textbox', {
    name: 'Primary Spherical Aberration Z(4,0) coefficient'
  });
  expect(sphericalCoefficient).toHaveValue('0.00');
  expect(sphericalCoefficient).toHaveAttribute('autocomplete', 'off');

  const spherical = screen.getByRole('slider', {
    name: 'Primary Spherical Aberration Z(4,0) coefficient'
  });
  await act(async () => {
    fireEvent.keyDown(spherical, { key: 'ArrowRight' });
  });
  await act(async () => {
    fireEvent.keyDown(spherical, { key: 'ArrowRight' });
  });
  expect(sphericalCoefficient).toHaveValue('0.10');

  await user.click(screen.getByRole('button', { name: 'Reset aberrations' }));
  expect(sphericalCoefficient).toHaveValue('0.00');

  await user.clear(sphericalCoefficient);
  await user.type(sphericalCoefficient, '1.25');
  expect(sphericalCoefficient).toHaveValue('1.25');

  await user.click(screen.getByRole('button', { name: 'Reset aberrations' }));
  expect(sphericalCoefficient).toHaveValue('0.00');
});

it('commits valid zernike textbox values to the worker payload', async () => {
  vi.useFakeTimers();
  const computeConvolvedImage = vi.fn(
    async (input: ConvolvedImageInput): Promise<ConvolvedImageResult> => ({
      imageUrl: `data:image/png;base64,${window.btoa(input.targetId)}`,
      psfImageUrl: `data:image/png;base64,${window.btoa(`${input.targetId}-psf`)}`,
      wavefrontImageUrl: `data:image/png;base64,${window.btoa(`${input.targetId}-wavefront`)}`,
      diagnostics: {
        status: 'ready',
        message: 'Mock worker ready'
      }
    })
  );

  render(<App workerClient={createMockWorkerClient({ computeConvolvedImage })} />);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  computeConvolvedImage.mockClear();

  const sphericalCoefficient = screen.getByRole('textbox', {
    name: 'Primary Spherical Aberration Z(4,0) coefficient'
  });
  fireEvent.change(sphericalCoefficient, {
    target: { value: '-0.3' }
  });

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });

  expect(computeConvolvedImage).toHaveBeenCalledWith({
    apertureDiameterMm: 3,
    targetId: 'snellen_e_20_20',
    zernikeCoefficients: expect.objectContaining({
      '4,0': -0.3
    })
  });
});

it('keeps temporary invalid zernike textbox drafts out of the worker payload', async () => {
  vi.useFakeTimers();
  const computeConvolvedImage = vi.fn(
    async (input: ConvolvedImageInput): Promise<ConvolvedImageResult> => ({
      imageUrl: `data:image/png;base64,${window.btoa(input.targetId)}`,
      psfImageUrl: `data:image/png;base64,${window.btoa(`${input.targetId}-psf`)}`,
      wavefrontImageUrl: `data:image/png;base64,${window.btoa(`${input.targetId}-wavefront`)}`,
      diagnostics: {
        status: 'ready',
        message: 'Mock worker ready'
      }
    })
  );

  render(<App workerClient={createMockWorkerClient({ computeConvolvedImage })} />);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  computeConvolvedImage.mockClear();

  const sphericalCoefficient = screen.getByRole('textbox', {
    name: 'Primary Spherical Aberration Z(4,0) coefficient'
  });
  fireEvent.change(sphericalCoefficient, {
    target: { value: '' }
  });
  expect(sphericalCoefficient).toHaveValue('');

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  expect(computeConvolvedImage).not.toHaveBeenCalled();

  fireEvent.change(sphericalCoefficient, {
    target: { value: '-' }
  });
  expect(sphericalCoefficient).toHaveValue('-');

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  expect(computeConvolvedImage).not.toHaveBeenCalled();
});

it('shows inline errors for out-of-range zernike textbox drafts without worker calls', async () => {
  vi.useFakeTimers();
  const computeConvolvedImage = vi.fn(
    async (input: ConvolvedImageInput): Promise<ConvolvedImageResult> => ({
      imageUrl: `data:image/png;base64,${window.btoa(input.targetId)}`,
      psfImageUrl: `data:image/png;base64,${window.btoa(`${input.targetId}-psf`)}`,
      wavefrontImageUrl: `data:image/png;base64,${window.btoa(`${input.targetId}-wavefront`)}`,
      diagnostics: {
        status: 'ready',
        message: 'Mock worker ready'
      }
    })
  );

  render(<App workerClient={createMockWorkerClient({ computeConvolvedImage })} />);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  computeConvolvedImage.mockClear();

  const sphericalCoefficient = screen.getByRole('textbox', {
    name: 'Primary Spherical Aberration Z(4,0) coefficient'
  });
  fireEvent.change(sphericalCoefficient, {
    target: { value: '2.01' }
  });
  expect(sphericalCoefficient).toHaveValue('2.01');
  expect(screen.getByText('Value must be between -2 and 2.')).toBeInTheDocument();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  expect(computeConvolvedImage).not.toHaveBeenCalled();

  fireEvent.change(sphericalCoefficient, {
    target: { value: '-2.01' }
  });
  expect(sphericalCoefficient).toHaveValue('-2.01');
  expect(screen.getByText('Value must be between -2 and 2.')).toBeInTheDocument();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  expect(computeConvolvedImage).not.toHaveBeenCalled();
});

it('debounces worker calls using the current UI payload', async () => {
  vi.useFakeTimers();
  const computeConvolvedImage = vi.fn(
    async (input: ConvolvedImageInput): Promise<ConvolvedImageResult> => ({
      imageUrl: `data:image/png;base64,${window.btoa(input.targetId)}`,
      psfImageUrl: `data:image/png;base64,${window.btoa(`${input.targetId}-psf`)}`,
      wavefrontImageUrl: `data:image/png;base64,${window.btoa(`${input.targetId}-wavefront`)}`,
      diagnostics: {
        status: 'ready',
        message: 'Mock worker ready',
        pyodideVersion: '0.29.3'
      }
    })
  );

  render(<App workerClient={createMockWorkerClient({ computeConvolvedImage })} />);

  expect(screen.getByText('Preparing simulation')).toBeInTheDocument();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  expect(computeConvolvedImage).toHaveBeenCalledWith({
    apertureDiameterMm: 3,
    targetId: 'snellen_e_20_20',
    zernikeCoefficients: expect.objectContaining({
      '4,0': 0
    })
  });

  fireEvent.change(screen.getByLabelText('Aperture Diameter (mm)'), {
    target: { value: '4' }
  });
  fireEvent.change(screen.getByLabelText('Target'), {
    target: { value: 'logmar_chart' }
  });
  fireEvent.keyDown(screen.getByRole('slider', { name: 'Defocus Z(2,0) coefficient' }), {
    key: 'ArrowRight'
  });

  computeConvolvedImage.mockClear();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(299);
  });
  expect(computeConvolvedImage).not.toHaveBeenCalled();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });

  expect(computeConvolvedImage).toHaveBeenCalledWith({
    apertureDiameterMm: 4,
    targetId: 'logmar_chart',
    zernikeCoefficients: expect.objectContaining({
      '2,0': 0.05,
      '4,0': 0
    })
  });
});

it('renders simulated image loading and error states', async () => {
  vi.useFakeTimers();
  const computeConvolvedImage = vi
    .fn()
    .mockRejectedValueOnce(new Error('Simulation exploded'))
    .mockResolvedValueOnce({
      imageUrl: 'data:image/png;base64,c2ltdWxhdGVk',
      psfImageUrl: 'data:image/png;base64,cHNm',
      wavefrontImageUrl: 'data:image/png;base64,d2F2ZWZyb250',
      diagnostics: {
        status: 'ready',
        message: 'Mock worker ready'
      }
    } satisfies ConvolvedImageResult);

  const { rerender } = render(
    <App workerClient={createMockWorkerClient({ computeConvolvedImage })} />
  );

  expect(screen.getByText('Preparing simulation')).toBeInTheDocument();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  expect(screen.getByText('Simulation exploded')).toBeInTheDocument();

  rerender(<App workerClient={createMockWorkerClient()} />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  expect(screen.getByAltText('Convolved simulated target')).toBeInTheDocument();
});

it('shows PSF and wavefront cards in advanced display mode', async () => {
  const user = userEvent.setup();
  render(<App workerClient={createMockWorkerClient()} />);

  expect(screen.getByRole('heading', { name: 'Simulated Image' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'PSF' })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Wavefront Map' })).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Setting' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  await user.keyboard('{Escape}');

  expect(screen.getByRole('heading', { name: 'PSF' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Wavefront Map' })).toBeInTheDocument();
});

it('hides the PSF card for point source targets in advanced display mode', async () => {
  const user = userEvent.setup();
  render(<App workerClient={createMockWorkerClient()} />);

  await user.click(screen.getByRole('button', { name: 'Setting' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  await user.keyboard('{Escape}');
  fireEvent.change(screen.getByLabelText('Target'), {
    target: { value: 'point_source' }
  });

  expect(screen.getByRole('heading', { name: 'Simulated Image' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'PSF' })).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Wavefront Map' })).toBeInTheDocument();
});
