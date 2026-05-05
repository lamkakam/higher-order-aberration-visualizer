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
});

it('renders default aperture and supported target options', async () => {
  const user = userEvent.setup();
  render(<App workerClient={createMockWorkerClient()} />);

  expect(screen.getByRole('heading', { name: 'Optical System Config' })).toBeInTheDocument();
  expect(screen.getByLabelText('Aperture Diameter (mm)')).toHaveValue(3);
  expect(screen.queryByText('Minimum value is 0.5.')).not.toBeInTheDocument();

  await user.click(screen.getByLabelText('Target'));

  expect(screen.getByRole('option', { name: 'Snellen Chart Letter E on 20/20' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'LogMAR Chart' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Siemens Star' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Slanted Edge' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Tilted Square' })).toBeInTheDocument();
});

it('shows zernike slider values and resets changed values', async () => {
  const user = userEvent.setup();
  render(<App workerClient={createMockWorkerClient()} />);

  expect(screen.getByRole('heading', { name: 'Optical Aberrations (Zernike)' })).toBeInTheDocument();
  expect(screen.getByTestId('zernike-value-4,0')).toHaveTextContent('0.00');

  const spherical = screen.getByRole('slider', { name: 'Spherical (4,0)' });
  spherical.focus();
  await user.keyboard('{ArrowRight}{ArrowRight}');
  expect(screen.getByTestId('zernike-value-4,0')).toHaveTextContent('0.20');

  await user.click(screen.getByRole('button', { name: 'Reset aberrations' }));
  expect(screen.getByTestId('zernike-value-4,0')).toHaveTextContent('0.00');
});

it('debounces worker calls using the current UI payload', async () => {
  vi.useFakeTimers();
  const computeConvolvedImage = vi.fn(
    async (input: ConvolvedImageInput): Promise<ConvolvedImageResult> => ({
      imageUrl: `data:image/png;base64,${window.btoa(input.targetId)}`,
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
  fireEvent.keyDown(screen.getByRole('slider', { name: 'Defocus (2,0)' }), {
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
      '2,0': 0.1,
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
