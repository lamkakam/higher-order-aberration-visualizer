import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from './App';
import { createMockWorkerClient } from './test/workerMock';
import type {
  ApertureMaskResult,
  ConvolvedImageInput,
  ConvolvedImageResult
} from './workers/types';

const psfCutoffNote =
  'The PSF chart may show a clear intensity cutoff around the central region. This limit is intentional: it keeps chart generation responsive while reducing memory use and computational cost, without changing the underlying optical simulation.';
const defaultApertureSettings = {
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
} as const;

function getCentralObstructionRatioTextbox(container: HTMLElement = document.body) {
  return within(container).getByRole('textbox', { name: 'Central Obstruction Ratio' });
}

function getCentralObstructionRatioSlider(container: HTMLElement = document.body) {
  return within(container).getByRole('slider', { name: 'Central Obstruction Ratio' });
}

function getGaussianApodizationSwitch(container: HTMLElement = document.body) {
  return within(container).getByRole('switch', { name: 'Gaussian Apodization' });
}

function getSpiderVanesTextbox(container: HTMLElement = document.body) {
  return within(container).getByRole('textbox', { name: 'Spider Vanes' });
}

function getSpiderVanesSlider(container: HTMLElement = document.body) {
  return within(container).getByRole('slider', { name: 'Spider Vanes' });
}

function getSpiderVaneWidthTextbox(container: HTMLElement = document.body) {
  return within(container).getByRole('textbox', {
    name: 'Vane Width (x Aperture Diameter)'
  });
}

function getSpiderVaneWidthSlider(container: HTMLElement = document.body) {
  return within(container).getByRole('slider', {
    name: 'Vane Width (x Aperture Diameter)'
  });
}

function getSpiderVaneRotationTextbox(container: HTMLElement = document.body) {
  return within(container).getByRole('textbox', { name: 'Vane Rotation' });
}

function getSpiderVaneRotationSlider(container: HTMLElement = document.body) {
  return within(container).getByRole('slider', { name: 'Vane Rotation' });
}

function getGaussianSigmaRatioTextbox(container: HTMLElement = document.body) {
  return within(container).getByRole('textbox', {
    name: 'Standard Deviation (x Aperture Diameter)'
  });
}

function setMatchesSm(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('min-width:600px') ? matches : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
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
  expect(screen.queryByText('Wavefront legend unit')).not.toBeInTheDocument();
  expect(screen.queryByText('Legend Unit')).not.toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: 'Show scale bar' })).not.toBeChecked();
});

it('shows an app-level initialization mask while the worker initializes', async () => {
  let resolveInitialize: (diagnostics: ConvolvedImageResult['diagnostics']) => void = () => {};
  const initialize = vi.fn(
    () =>
      new Promise<ConvolvedImageResult['diagnostics']>((resolve) => {
        resolveInitialize = resolve;
      })
  );

  render(<App workerClient={createMockWorkerClient({ initialize })} />);

  expect(screen.getByRole('status', { name: 'Worker initialization' })).toBeInTheDocument();
  expect(screen.getByText('Initializing...')).toBeInTheDocument();
  expect(screen.getByRole('progressbar', { name: 'Initialization progress' })).toBeInTheDocument();

  await act(async () => {
    resolveInitialize({
      status: 'ready',
      message: 'Mock worker ready'
    });
  });

  expect(screen.queryByRole('status', { name: 'Worker initialization' })).not.toBeInTheDocument();
  expect(screen.queryByText('Initializing...')).not.toBeInTheDocument();
});

it('renders default aperture and supported target options', async () => {
  const user = userEvent.setup();
  render(<App workerClient={createMockWorkerClient()} />);

  expect(screen.getByRole('heading', { name: 'Optical System Config' })).toBeInTheDocument();
  expect(screen.getByLabelText('Aperture Diameter (mm)')).toHaveValue('6');
  expect(screen.queryByText('Minimum value is 0.5.')).not.toBeInTheDocument();

  await user.click(screen.getByLabelText('Target'));

  const targetOptions = screen.getAllByRole('option');
  expect(targetOptions[0]).toHaveTextContent('Eye Chart (logMAR)');
  expect(targetOptions[0]).toHaveValue('logmar_chart');
  expect(screen.getByRole('option', { name: 'Eye Chart (logMAR)' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Snellen Chart Letter E on 20/20' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Jupiter (HST 502 nm, 50 arcsec)' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Point Source (Airy Disc)' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Siemens Star' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Slanted Edge' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Tilted Square' })).toBeInTheDocument();
});

it('shows aperture mask controls only in advanced mode', async () => {
  const user = userEvent.setup();
  render(<App workerClient={createMockWorkerClient()} />);

  expect(screen.queryByRole('button', { name: 'Edit aperture mask' })).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Setting' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

  expect(screen.getByRole('button', { name: 'Edit aperture mask' })).toBeInTheDocument();
  expect(screen.getByText('Circle, 0% obstruction')).toBeInTheDocument();
});

it('opens an aperture mask modal that only closes through confirm or cancel', async () => {
  const user = userEvent.setup();
  let resolvePreview: (value: ApertureMaskResult) => void = () => {};
  const renderApertureMask = vi.fn(
    () =>
      new Promise<ApertureMaskResult>((resolve) => {
        resolvePreview = resolve;
      })
  );
  render(<App workerClient={createMockWorkerClient({ renderApertureMask })} />);

  await user.click(screen.getByRole('button', { name: 'Setting' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await user.click(screen.getByRole('button', { name: 'Edit aperture mask' }));

  const modal = screen.getByRole('dialog', { name: 'Aperture Mask' });
  expect(within(modal).getByLabelText('Aperture Shape')).toHaveValue('circle');
  expect(within(modal).getByRole('option', { name: 'Circle' })).toBeInTheDocument();
  expect(within(modal).getByRole('option', { name: 'Square' })).toBeInTheDocument();
  expect(within(modal).getByRole('option', { name: 'Regular Hexagon' })).toBeInTheDocument();
  expect(within(modal).queryByRole('option', { name: 'Ellipse' })).not.toBeInTheDocument();
  expect(getCentralObstructionRatioTextbox(modal)).toHaveValue('0');
  expect(getCentralObstructionRatioSlider(modal)).toBeInTheDocument();
  expect(getSpiderVanesTextbox(modal)).toHaveValue('0');
  expect(getSpiderVanesSlider(modal)).toBeInTheDocument();
  expect(getSpiderVaneWidthTextbox(modal)).toHaveValue('0');
  expect(getSpiderVaneWidthSlider(modal)).toBeInTheDocument();
  expect(getSpiderVaneRotationTextbox(modal)).toHaveValue('0');
  expect(getSpiderVaneRotationSlider(modal)).toBeInTheDocument();
  expect(
    getSpiderVaneWidthSlider(modal).compareDocumentPosition(getSpiderVaneRotationSlider(modal)) &
      Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  expect(
    getSpiderVaneRotationSlider(modal).compareDocumentPosition(getGaussianApodizationSwitch(modal)) &
      Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  expect(getGaussianApodizationSwitch(modal)).not.toBeChecked();
  expect(
    within(modal).queryByRole('slider', {
      name: 'Standard Deviation (x Aperture Diameter)'
    })
  ).not.toBeInTheDocument();
  expect(within(modal).queryByRole('slider', { name: 'Aperture Rotation' })).not.toBeInTheDocument();
  expect(within(modal).queryByLabelText('Obstruction Shape')).not.toBeInTheDocument();
  expect(within(modal).getByText('Preview')).toBeInTheDocument();
  expect(within(modal).getByText('Preparing aperture mask...')).toBeInTheDocument();
  expect(within(modal).getByRole('button', { name: 'Confirm aperture mask' })).toBeInTheDocument();
  expect(within(modal).getByRole('button', { name: 'Cancel aperture mask' })).toBeInTheDocument();

  fireEvent.keyDown(modal, { key: 'Escape' });
  expect(screen.getByRole('dialog', { name: 'Aperture Mask' })).toBeInTheDocument();

  const backdrop = document.querySelector('.MuiBackdrop-root') as HTMLElement;
  fireEvent.click(backdrop);
  expect(screen.getByRole('dialog', { name: 'Aperture Mask' })).toBeInTheDocument();

  await act(async () => {
    resolvePreview({
      imageUrl: `data:image/png;base64,${window.btoa('mask')}`,
      diagnostics: {
        status: 'ready',
        message: 'Mock worker ready'
      }
    });
  });
  expect(await within(modal).findByAltText('Aperture mask preview')).toBeInTheDocument();
  await user.click(within(modal).getByRole('button', { name: 'Cancel aperture mask' }));
  expect(screen.queryByRole('dialog', { name: 'Aperture Mask' })).not.toBeInTheDocument();
});

it('keeps aperture mask modal actions outside the scrollable content', async () => {
  const user = userEvent.setup();
  render(<App workerClient={createMockWorkerClient()} />);

  await user.click(screen.getByRole('button', { name: 'Setting' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await user.click(screen.getByRole('button', { name: 'Edit aperture mask' }));

  const modal = screen.getByRole('dialog', { name: 'Aperture Mask' });
  const content = within(modal).getByTestId('aperture-mask-modal-content');
  const footer = within(modal).getByTestId('aperture-mask-modal-footer');

  expect(content.style.overflowY).toBe('auto');
  expect(content.style.minHeight).toBe('0');
  expect(content).toHaveStyle({
    paddingLeft: '16px',
    paddingRight: '20px',
    scrollbarGutter: 'stable'
  });
  expect(footer.style.flexShrink).toBe('0');
  expect(content).not.toContainElement(within(modal).getByRole('button', { name: 'Cancel aperture mask' }));
  expect(footer).toContainElement(within(modal).getByRole('button', { name: 'Cancel aperture mask' }));
  expect(footer).toContainElement(within(modal).getByRole('button', { name: 'Confirm aperture mask' }));
});

it('shows Gaussian apodization SD controls only when enabled', async () => {
  const user = userEvent.setup();
  render(<App workerClient={createMockWorkerClient()} />);

  await user.click(screen.getByRole('button', { name: 'Setting' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await user.click(screen.getByRole('button', { name: 'Edit aperture mask' }));

  const modal = screen.getByRole('dialog', { name: 'Aperture Mask' });
  expect(getGaussianApodizationSwitch(modal)).not.toBeChecked();
  expect(
    within(modal).queryByRole('textbox', {
      name: 'Standard Deviation (x Aperture Diameter)'
    })
  ).not.toBeInTheDocument();

  await user.click(getGaussianApodizationSwitch(modal));

  expect(getGaussianApodizationSwitch(modal)).toBeChecked();
  expect(
    within(modal).getByRole('slider', {
      name: 'Standard Deviation (x Aperture Diameter)'
    })
  ).toBeInTheDocument();
  expect(getGaussianSigmaRatioTextbox(modal)).toHaveValue('0.5');
});

it('shows aperture shape controls conditionally in the aperture mask modal', async () => {
  const user = userEvent.setup();
  render(<App workerClient={createMockWorkerClient()} />);

  await user.click(screen.getByRole('button', { name: 'Setting' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await user.click(screen.getByRole('button', { name: 'Edit aperture mask' }));

  const modal = screen.getByRole('dialog', { name: 'Aperture Mask' });
  fireEvent.change(within(modal).getByLabelText('Aperture Shape'), {
    target: { value: 'square' }
  });
  expect(within(modal).getByRole('slider', { name: 'Aperture Rotation' })).toBeInTheDocument();
  expect(within(modal).getByRole('textbox', { name: 'Aperture Rotation' })).toBeInTheDocument();
  expect(within(modal).queryByLabelText('Aperture Ellipse Minor-Axis Ratio')).not.toBeInTheDocument();

  fireEvent.change(within(modal).getByLabelText('Aperture Shape'), {
    target: { value: 'regular_hexagon' }
  });
  expect(within(modal).getByRole('slider', { name: 'Aperture Rotation' })).toBeInTheDocument();

  fireEvent.change(getCentralObstructionRatioTextbox(modal), {
    target: { value: '0.25' }
  });
  fireEvent.blur(getCentralObstructionRatioTextbox(modal));
  expect(within(modal).getByLabelText('Obstruction Shape')).toHaveValue('circle');
  expect(
    within(modal).getByLabelText('Obstruction Shape').compareDocumentPosition(
      getGaussianApodizationSwitch(modal)
    ) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  expect(within(modal).getAllByRole('option', { name: 'Circle' })).toHaveLength(2);
  expect(within(modal).getAllByRole('option', { name: 'Square' })).toHaveLength(2);
  expect(within(modal).getAllByRole('option', { name: 'Regular Hexagon' })).toHaveLength(2);
  expect(within(modal).queryAllByRole('option', { name: 'Ellipse' })).toHaveLength(0);

  fireEvent.change(within(modal).getByLabelText('Obstruction Shape'), {
    target: { value: 'square' }
  });
  expect(within(modal).getByRole('slider', { name: 'Obstruction Rotation' })).toBeInTheDocument();
  expect(within(modal).getByRole('textbox', { name: 'Obstruction Rotation' })).toBeInTheDocument();
  expect(within(modal).queryByLabelText('Obstruction Ellipse Minor-Axis Ratio')).not.toBeInTheDocument();

  fireEvent.change(getCentralObstructionRatioTextbox(modal), {
    target: { value: '0' }
  });
  fireEvent.blur(getCentralObstructionRatioTextbox(modal));
  expect(within(modal).queryByLabelText('Obstruction Shape')).not.toBeInTheDocument();
});

it('toggles aperture obstruction controls from the ratio slider and textbox', async () => {
  const user = userEvent.setup();
  render(<App workerClient={createMockWorkerClient()} />);

  await user.click(screen.getByRole('button', { name: 'Setting' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await user.click(screen.getByRole('button', { name: 'Edit aperture mask' }));

  const modal = screen.getByRole('dialog', { name: 'Aperture Mask' });
  const ratioSlider = getCentralObstructionRatioSlider(modal);

  fireEvent.keyDown(ratioSlider, { key: 'ArrowRight' });
  expect(within(modal).queryByLabelText('Obstruction Shape')).not.toBeInTheDocument();
  fireEvent.keyUp(ratioSlider, { key: 'ArrowRight' });
  expect(within(modal).getByLabelText('Obstruction Shape')).toHaveValue('circle');

  fireEvent.change(getCentralObstructionRatioTextbox(modal), {
    target: { value: '0' }
  });
  fireEvent.blur(getCentralObstructionRatioTextbox(modal));
  expect(within(modal).queryByLabelText('Obstruction Shape')).not.toBeInTheDocument();
});

it('commits aperture rotation textbox values to the confirmed payload', async () => {
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

  fireEvent.click(screen.getByRole('button', { name: 'Setting' }));
  fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  fireEvent.click(screen.getByRole('button', { name: 'Edit aperture mask' }));
  fireEvent.change(screen.getByLabelText('Aperture Shape'), {
    target: { value: 'square' }
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'Aperture Rotation' }), {
    target: { value: '45' }
  });
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Aperture Rotation' }), {
    key: 'Enter'
  });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm aperture mask' }));

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });

  expect(computeConvolvedImage).toHaveBeenCalledWith({
    apertureSettings: {
      shape: 'square',
      rotationDegrees: 45,
      centralObstructionShape: 'circle',
      centralObstructionRotationDegrees: 0,
      centralObstructionRatio: 0,
      spiderVaneCount: 0,
      spiderVaneWidthRatio: 0,
      spiderVaneRotationDegrees: 0,
      gaussianApodizationEnabled: false,
      gaussianApodizationSigmaRatio: 0.5
    },
    apertureDiameterMm: 6,
    diagnosticWavelengthNm: 550,
    showScaleBar: false,
    spectralMode: 'monochromatic',
    targetId: 'logmar_chart',
    wavefrontLegendUnit: 'wave',
    wavelengthWeights: [[550, 1]],
    zernikeCoefficientsByWavelength: [[550, expect.objectContaining({ '4,0': 0 })]]
  });
});

it('keeps the aperture preview panel height stable while loading and loaded', async () => {
  const user = userEvent.setup();
  let resolvePreview: (value: ApertureMaskResult) => void = () => {};
  const renderApertureMask = vi.fn(
    () =>
      new Promise<ApertureMaskResult>((resolve) => {
        resolvePreview = resolve;
      })
  );
  render(<App workerClient={createMockWorkerClient({ renderApertureMask })} />);

  await user.click(screen.getByRole('button', { name: 'Setting' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await user.click(screen.getByRole('button', { name: 'Edit aperture mask' }));

  const panel = screen.getByTestId('aperture-mask-preview-panel');
  expect(panel).toHaveStyle({ height: '280px', minHeight: '280px' });
  expect(within(panel).getByText('Preparing aperture mask...')).toBeInTheDocument();

  await act(async () => {
    resolvePreview({
      imageUrl: `data:image/png;base64,${window.btoa('mask')}`,
      diagnostics: {
        status: 'ready',
        message: 'Mock worker ready'
      }
    });
  });

  expect(within(panel).getByAltText('Aperture mask preview')).toBeInTheDocument();
  expect(panel).toHaveStyle({ height: '280px', minHeight: '280px' });
});

it('cancels draft aperture mask changes and preserves previous simulation settings', async () => {
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

  fireEvent.click(screen.getByRole('button', { name: 'Setting' }));
  fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  fireEvent.click(screen.getByRole('button', { name: 'Edit aperture mask' }));
  fireEvent.change(getCentralObstructionRatioTextbox(), {
    target: { value: '0.35' }
  });
  fireEvent.blur(getCentralObstructionRatioTextbox());
  fireEvent.change(screen.getByLabelText('Aperture Shape'), {
    target: { value: 'square' }
  });
  fireEvent.click(getGaussianApodizationSwitch());
  fireEvent.click(screen.getByRole('button', { name: 'Cancel aperture mask' }));

  expect(screen.getByText('Circle, 0% obstruction')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Aperture Diameter (mm)'), {
    target: { value: '5' }
  });
  fireEvent.blur(screen.getByLabelText('Aperture Diameter (mm)'));

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  expect(computeConvolvedImage).toHaveBeenCalledWith({
    apertureSettings: defaultApertureSettings,
    apertureDiameterMm: 5,
    diagnosticWavelengthNm: 550,
    showScaleBar: false,
    spectralMode: 'monochromatic',
    targetId: 'logmar_chart',
    wavefrontLegendUnit: 'wave',
    wavelengthWeights: [[550, 1]],
    zernikeCoefficientsByWavelength: [[550, expect.objectContaining({ '4,0': 0 })]]
  });
});

it('cancels draft Gaussian apodization changes and preserves previous simulation settings', async () => {
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

  fireEvent.click(screen.getByRole('button', { name: 'Setting' }));
  fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  fireEvent.click(screen.getByRole('button', { name: 'Edit aperture mask' }));
  fireEvent.click(getGaussianApodizationSwitch());
  fireEvent.change(getGaussianSigmaRatioTextbox(), {
    target: { value: '0.25' }
  });
  fireEvent.blur(getGaussianSigmaRatioTextbox());
  fireEvent.click(screen.getByRole('button', { name: 'Cancel aperture mask' }));

  expect(screen.getByText('Circle, 0% obstruction')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Aperture Diameter (mm)'), {
    target: { value: '5' }
  });
  fireEvent.blur(screen.getByLabelText('Aperture Diameter (mm)'));

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  expect(computeConvolvedImage).toHaveBeenCalledWith({
    apertureSettings: defaultApertureSettings,
    apertureDiameterMm: 5,
    diagnosticWavelengthNm: 550,
    showScaleBar: false,
    spectralMode: 'monochromatic',
    targetId: 'logmar_chart',
    wavefrontLegendUnit: 'wave',
    wavelengthWeights: [[550, 1]],
    zernikeCoefficientsByWavelength: [[550, expect.objectContaining({ '4,0': 0 })]]
  });
});

it('commits spider vane textbox values to the confirmed payload', async () => {
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

  fireEvent.click(screen.getByRole('button', { name: 'Setting' }));
  fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  fireEvent.click(screen.getByRole('button', { name: 'Edit aperture mask' }));
  fireEvent.change(getSpiderVanesTextbox(), {
    target: { value: '4' }
  });
  fireEvent.blur(getSpiderVanesTextbox());
  fireEvent.change(getSpiderVaneWidthTextbox(), {
    target: { value: '0.02' }
  });
  fireEvent.blur(getSpiderVaneWidthTextbox());
  fireEvent.change(getSpiderVaneRotationTextbox(), {
    target: { value: '30' }
  });
  fireEvent.blur(getSpiderVaneRotationTextbox());
  fireEvent.click(screen.getByRole('button', { name: 'Confirm aperture mask' }));

  expect(
    screen.getByText(
      'Circle, 0% obstruction, 4-vane spider rotated 30 deg, each vane 0.02D wide'
    )
  ).toBeInTheDocument();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  expect(computeConvolvedImage).toHaveBeenCalledWith({
    apertureSettings: {
      shape: 'circle',
      rotationDegrees: 0,
      centralObstructionShape: 'circle',
      centralObstructionRotationDegrees: 0,
      centralObstructionRatio: 0,
      spiderVaneCount: 4,
      spiderVaneWidthRatio: 0.02,
      spiderVaneRotationDegrees: 30,
      gaussianApodizationEnabled: false,
      gaussianApodizationSigmaRatio: 0.5
    },
    apertureDiameterMm: 6,
    diagnosticWavelengthNm: 550,
    showScaleBar: false,
    spectralMode: 'monochromatic',
    targetId: 'logmar_chart',
    wavefrontLegendUnit: 'wave',
    wavelengthWeights: [[550, 1]],
    zernikeCoefficientsByWavelength: [[550, expect.objectContaining({ '4,0': 0 })]]
  });
});

it('omits spider vane settings from the aperture summary when width is zero', async () => {
  const user = userEvent.setup();
  render(<App workerClient={createMockWorkerClient()} />);

  await user.click(screen.getByRole('button', { name: 'Setting' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await user.click(screen.getByRole('button', { name: 'Edit aperture mask' }));

  fireEvent.change(getSpiderVanesTextbox(), {
    target: { value: '4' }
  });
  fireEvent.blur(getSpiderVanesTextbox());
  fireEvent.click(screen.getByRole('button', { name: 'Confirm aperture mask' }));

  expect(screen.getByText('Circle, 0% obstruction')).toBeInTheDocument();
  expect(screen.queryByText(/spider/iu)).not.toBeInTheDocument();
});

it('omits spider vane settings from the aperture summary when count is zero', async () => {
  const user = userEvent.setup();
  render(<App workerClient={createMockWorkerClient()} />);

  await user.click(screen.getByRole('button', { name: 'Setting' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await user.click(screen.getByRole('button', { name: 'Edit aperture mask' }));

  fireEvent.change(getSpiderVaneWidthTextbox(), {
    target: { value: '0.02' }
  });
  fireEvent.blur(getSpiderVaneWidthTextbox());
  fireEvent.change(getSpiderVaneRotationTextbox(), {
    target: { value: '30' }
  });
  fireEvent.blur(getSpiderVaneRotationTextbox());
  fireEvent.click(screen.getByRole('button', { name: 'Confirm aperture mask' }));

  expect(screen.getByText('Circle, 0% obstruction')).toBeInTheDocument();
  expect(screen.queryByText(/spider/iu)).not.toBeInTheDocument();
});

it('confirms aperture mask changes and sends them in the next simulation payload', async () => {
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

  fireEvent.click(screen.getByRole('button', { name: 'Setting' }));
  fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  fireEvent.click(screen.getByRole('button', { name: 'Edit aperture mask' }));
  fireEvent.change(getCentralObstructionRatioTextbox(), {
    target: { value: '0.35' }
  });
  fireEvent.blur(getCentralObstructionRatioTextbox());
  fireEvent.change(screen.getByLabelText('Aperture Shape'), {
    target: { value: 'square' }
  });
  fireEvent.change(screen.getByLabelText('Obstruction Shape'), {
    target: { value: 'regular_hexagon' }
  });
  fireEvent.change(getSpiderVanesTextbox(), {
    target: { value: '4' }
  });
  fireEvent.blur(getSpiderVanesTextbox());
  fireEvent.change(getSpiderVaneWidthTextbox(), {
    target: { value: '0.02' }
  });
  fireEvent.blur(getSpiderVaneWidthTextbox());
  fireEvent.change(getSpiderVaneRotationTextbox(), {
    target: { value: '30' }
  });
  fireEvent.blur(getSpiderVaneRotationTextbox());
  fireEvent.click(getGaussianApodizationSwitch());
  fireEvent.change(getGaussianSigmaRatioTextbox(), {
    target: { value: '0.75' }
  });
  fireEvent.blur(getGaussianSigmaRatioTextbox());
  fireEvent.click(screen.getByRole('button', { name: 'Confirm aperture mask' }));

  expect(screen.queryByRole('dialog', { name: 'Aperture Mask' })).not.toBeInTheDocument();
  expect(
    screen.getByText(
      'Square, 35% regular hexagon obstruction, 4-vane spider rotated 30 deg, each vane 0.02D wide, Gaussian apodization with 0.75D sigma'
    )
  ).toBeInTheDocument();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  expect(computeConvolvedImage).toHaveBeenCalledWith({
    apertureSettings: {
      shape: 'square',
      rotationDegrees: 0,
      centralObstructionShape: 'regular_hexagon',
      centralObstructionRotationDegrees: 0,
      centralObstructionRatio: 0.35,
      spiderVaneCount: 4,
      spiderVaneWidthRatio: 0.02,
      spiderVaneRotationDegrees: 30,
      gaussianApodizationEnabled: true,
      gaussianApodizationSigmaRatio: 0.75
    },
    apertureDiameterMm: 6,
    diagnosticWavelengthNm: 550,
    showScaleBar: false,
    spectralMode: 'monochromatic',
    targetId: 'logmar_chart',
    wavefrontLegendUnit: 'wave',
    wavelengthWeights: [[550, 1]],
    zernikeCoefficientsByWavelength: [[550, expect.objectContaining({ '4,0': 0 })]]
  });
});

it('describes the default simulated image target in plain language', async () => {
  vi.useFakeTimers();
  await act(async () => {
    render(<App workerClient={createMockWorkerClient()} />);
  });

  expect(screen.queryByText(psfCutoffNote)).not.toBeInTheDocument();
  expect(
    screen.getByText(
      'This shows how the selected picture would look through the current optical settings. Current target: The first six lines of an eye chart, with letters arranged in rows.'
    )
  ).toBeInTheDocument();
});

it('updates the simulated image description when the target changes', async () => {
  vi.useFakeTimers();
  await act(async () => {
    render(<App workerClient={createMockWorkerClient()} />);
  });

  await act(async () => {
    fireEvent.change(screen.getByLabelText('Target'), {
      target: { value: 'logmar_chart' }
    });
  });

  expect(
    screen.getByText(
      'This shows how the selected picture would look through the current optical settings. Current target: The first six lines of an eye chart, with letters arranged in rows.'
    )
  ).toBeInTheDocument();

  await act(async () => {
    fireEvent.change(screen.getByLabelText('Target'), {
      target: { value: 'siemensstar' }
    });
  });

  expect(
    screen.getByText(
      'This shows how the selected picture would look through the current optical settings. Current target: A circular pattern of black-and-white spokes, useful for showing where fine details become blurred.'
    )
  ).toBeInTheDocument();
  expect(screen.queryByText(psfCutoffNote)).not.toBeInTheDocument();
});

it('shows zernike textbox values and resets changed values', async () => {
  const user = userEvent.setup();
  render(<App workerClient={createMockWorkerClient()} />);

  expect(screen.getByRole('heading', { name: 'Optical Aberrations (Zernike)' })).toBeInTheDocument();
  expect(
    screen.getByRole('textbox', { name: 'Pentafoil (Vertical) Z(5,-5) coefficient' })
  ).toHaveValue('0.00');
  expect(
    screen.getByRole('textbox', {
      name: 'Secondary Spherical Aberration Z(6,0) coefficient'
    })
  ).toHaveValue('0.00');
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
  expect(sphericalCoefficient).toHaveValue('0.00');
  await act(async () => {
    fireEvent.keyUp(spherical, { key: 'ArrowRight' });
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

it('shows the zernike coefficient unit selector defaulting to wave', async () => {
  vi.useFakeTimers();
  render(<App workerClient={createMockWorkerClient()} />);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });

  expect(screen.getByText('Coefficient Unit (RMS)')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Wave' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Micron' })).toHaveAttribute('aria-pressed', 'false');
});

it('shows the spectral selector only in Advanced Mode defaulting to monochromatic', async () => {
  const user = userEvent.setup();
  render(<App workerClient={createMockWorkerClient()} />);

  expect(screen.queryByText('Spectral Mode')).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Setting' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

  expect(screen.getByText('Spectral Mode')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Monochromatic' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  expect(screen.getByRole('button', { name: 'Polychromatic' })).toHaveAttribute(
    'aria-pressed',
    'false'
  );
});

it('does not show wavelength tabs in Basic Mode or Advanced Monochromatic mode', async () => {
  const user = userEvent.setup();
  render(<App workerClient={createMockWorkerClient()} />);

  expect(screen.queryByRole('tab', { name: '550 nm' })).not.toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: '656 nm' })).not.toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: '486 nm' })).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Setting' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

  expect(screen.queryByRole('tab', { name: '550 nm' })).not.toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: '656 nm' })).not.toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: '486 nm' })).not.toBeInTheDocument();
});

it('shows wavelength tabs in Advanced Polychromatic mode', async () => {
  const user = userEvent.setup();
  render(<App workerClient={createMockWorkerClient()} />);

  await user.click(screen.getByRole('button', { name: 'Setting' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await user.click(screen.getByRole('button', { name: 'Polychromatic' }));

  expect(screen.getByRole('tab', { name: '550 nm' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tab', { name: '656 nm' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: '486 nm' })).toBeInTheDocument();
});

it('keeps polychromatic wavelength aberration values independent', async () => {
  const user = userEvent.setup();
  render(<App workerClient={createMockWorkerClient()} />);

  await user.click(screen.getByRole('button', { name: 'Setting' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await user.click(screen.getByRole('button', { name: 'Polychromatic' }));

  const sphericalName = 'Primary Spherical Aberration Z(4,0) coefficient';
  await user.clear(screen.getByRole('textbox', { name: sphericalName }));
  await user.type(screen.getByRole('textbox', { name: sphericalName }), '1.00');
  fireEvent.blur(screen.getByRole('textbox', { name: sphericalName }));

  await user.click(screen.getByRole('tab', { name: '656 nm' }));
  expect(screen.getByRole('textbox', { name: sphericalName })).toHaveValue('0.00');
  await user.clear(screen.getByRole('textbox', { name: sphericalName }));
  await user.type(screen.getByRole('textbox', { name: sphericalName }), '2.00');
  fireEvent.blur(screen.getByRole('textbox', { name: sphericalName }));

  await user.click(screen.getByRole('tab', { name: '486 nm' }));
  expect(screen.getByRole('textbox', { name: sphericalName })).toHaveValue('0.00');
  await user.clear(screen.getByRole('textbox', { name: sphericalName }));
  await user.type(screen.getByRole('textbox', { name: sphericalName }), '3.00');
  fireEvent.blur(screen.getByRole('textbox', { name: sphericalName }));

  await user.click(screen.getByRole('tab', { name: '550 nm' }));
  expect(screen.getByRole('textbox', { name: sphericalName })).toHaveValue('1.00');
  await user.click(screen.getByRole('tab', { name: '656 nm' }));
  expect(screen.getByRole('textbox', { name: sphericalName })).toHaveValue('2.00');
});

it('shares monochromatic aberration edits with the 550 nm polychromatic tab', async () => {
  const user = userEvent.setup();
  render(<App workerClient={createMockWorkerClient()} />);

  const sphericalName = 'Primary Spherical Aberration Z(4,0) coefficient';
  await user.clear(screen.getByRole('textbox', { name: sphericalName }));
  await user.type(screen.getByRole('textbox', { name: sphericalName }), '1.25');
  fireEvent.blur(screen.getByRole('textbox', { name: sphericalName }));

  await user.click(screen.getByRole('button', { name: 'Setting' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await user.click(screen.getByRole('button', { name: 'Polychromatic' }));

  expect(screen.getByRole('textbox', { name: sphericalName })).toHaveValue('1.25');
  await user.clear(screen.getByRole('textbox', { name: sphericalName }));
  await user.type(screen.getByRole('textbox', { name: sphericalName }), '2.00');
  fireEvent.blur(screen.getByRole('textbox', { name: sphericalName }));

  await user.click(screen.getByRole('button', { name: 'Monochromatic' }));

  expect(screen.queryByRole('tab', { name: '550 nm' })).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: sphericalName })).toHaveValue('2.00');
});

it('sends polychromatic worker payloads with wavelength weights and coefficient maps', async () => {
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

  fireEvent.click(screen.getByRole('button', { name: 'Setting' }));
  fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  fireEvent.click(screen.getByRole('button', { name: 'Polychromatic' }));

  const sphericalName = 'Primary Spherical Aberration Z(4,0) coefficient';
  fireEvent.change(screen.getByRole('textbox', { name: sphericalName }), {
    target: { value: '1.00' }
  });
  fireEvent.blur(screen.getByRole('textbox', { name: sphericalName }));
  fireEvent.click(screen.getByRole('tab', { name: '656 nm' }));
  fireEvent.change(screen.getByRole('textbox', { name: sphericalName }), {
    target: { value: '2.00' }
  });
  fireEvent.blur(screen.getByRole('textbox', { name: sphericalName }));
  fireEvent.click(screen.getByRole('tab', { name: '486 nm' }));
  fireEvent.change(screen.getByRole('textbox', { name: sphericalName }), {
    target: { value: '3.00' }
  });
  fireEvent.blur(screen.getByRole('textbox', { name: sphericalName }));

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });

  expect(computeConvolvedImage).toHaveBeenLastCalledWith({
    apertureSettings: defaultApertureSettings,
    apertureDiameterMm: 6,
    diagnosticWavelengthNm: 486,
    showScaleBar: false,
    spectralMode: 'polychromatic',
    targetId: 'logmar_chart',
    wavelengthWeights: [
      [550, 1],
      [656, 1],
      [486, 1]
    ],
    wavefrontLegendUnit: 'wave',
    zernikeCoefficientsByWavelength: [
      [550, expect.objectContaining({ '4,0': 1 })],
      [656, expect.objectContaining({ '4,0': 2 })],
      [486, expect.objectContaining({ '4,0': 3 })]
    ]
  });
});

it('recomputes polychromatic diagnostics for the selected wavelength tab', async () => {
  vi.useFakeTimers();
  const computeConvolvedImage = vi.fn(
    async (input: ConvolvedImageInput): Promise<ConvolvedImageResult> => ({
      imageUrl: `data:image/png;base64,${window.btoa(input.targetId)}`,
      psfImageUrl: `data:image/png;base64,${window.btoa(`${input.diagnosticWavelengthNm}-psf`)}`,
      wavefrontImageUrl: `data:image/png;base64,${window.btoa(`${input.diagnosticWavelengthNm}-wavefront`)}`,
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

  fireEvent.click(screen.getByRole('button', { name: 'Setting' }));
  fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  fireEvent.click(screen.getByRole('button', { name: 'Polychromatic' }));

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });

  expect(computeConvolvedImage).toHaveBeenLastCalledWith(
    expect.objectContaining({
      diagnosticWavelengthNm: 550,
      spectralMode: 'polychromatic'
    })
  );

  computeConvolvedImage.mockClear();
  fireEvent.click(screen.getByRole('tab', { name: '656 nm' }));

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });

  expect(computeConvolvedImage).toHaveBeenLastCalledWith(
    expect.objectContaining({
      diagnosticWavelengthNm: 656,
      spectralMode: 'polychromatic'
    })
  );
});

it('converts zernike textbox values when switching to microns', async () => {
  const user = userEvent.setup();
  render(<App workerClient={createMockWorkerClient()} />);

  const sphericalCoefficient = screen.getByRole('textbox', {
    name: 'Primary Spherical Aberration Z(4,0) coefficient'
  });
  await user.clear(sphericalCoefficient);
  await user.type(sphericalCoefficient, '1.00');
  fireEvent.blur(sphericalCoefficient);

  const coefficientMicronButton = screen
    .getAllByRole('button', { name: 'Micron' })
    .find((button) => button.getAttribute('aria-pressed') === 'false');
  expect(coefficientMicronButton).toBeDefined();
  await user.click(coefficientMicronButton as HTMLButtonElement);

  expect(sphericalCoefficient).toHaveValue('0.55');
});

it('converts polychromatic zernike textbox values using the selected wavelength tab', async () => {
  const user = userEvent.setup();
  render(<App workerClient={createMockWorkerClient()} />);

  await user.click(screen.getByRole('button', { name: 'Setting' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await user.click(screen.getByRole('button', { name: 'Polychromatic' }));

  const sphericalName = 'Primary Spherical Aberration Z(4,0) coefficient';
  await user.click(screen.getByRole('tab', { name: '486 nm' }));
  await user.clear(screen.getByRole('textbox', { name: sphericalName }));
  await user.type(screen.getByRole('textbox', { name: sphericalName }), '1.00');
  fireEvent.blur(screen.getByRole('textbox', { name: sphericalName }));

  await user.click(screen.getByRole('tab', { name: '656 nm' }));
  await user.clear(screen.getByRole('textbox', { name: sphericalName }));
  await user.type(screen.getByRole('textbox', { name: sphericalName }), '1.00');
  fireEvent.blur(screen.getByRole('textbox', { name: sphericalName }));

  const coefficientMicronButton = screen
    .getAllByRole('button', { name: 'Micron' })
    .find((button) => button.getAttribute('aria-pressed') === 'false');
  expect(coefficientMicronButton).toBeDefined();
  await user.click(coefficientMicronButton as HTMLButtonElement);

  expect(screen.getByRole('textbox', { name: sphericalName })).toHaveValue('0.66');

  await user.click(screen.getByRole('tab', { name: '486 nm' }));

  expect(screen.getByRole('textbox', { name: sphericalName })).toHaveValue('0.49');
});

it('commits micron zernike textbox values to the worker payload in waves', async () => {
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

  const coefficientMicronButton = screen
    .getAllByRole('button', { name: 'Micron' })
    .find((button) => button.getAttribute('aria-pressed') === 'false');
  expect(coefficientMicronButton).toBeDefined();
  fireEvent.click(coefficientMicronButton as HTMLButtonElement);
  fireEvent.change(
    screen.getByRole('textbox', {
      name: 'Primary Spherical Aberration Z(4,0) coefficient'
    }),
    {
      target: { value: '1.10' }
    }
  );

  await act(async () => {
    await vi.advanceTimersByTimeAsync(600);
  });
  expect(computeConvolvedImage).not.toHaveBeenCalled();
  fireEvent.blur(
    screen.getByRole('textbox', {
      name: 'Primary Spherical Aberration Z(4,0) coefficient'
    })
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });

  expect(computeConvolvedImage).toHaveBeenCalledTimes(1);
  expect(computeConvolvedImage).toHaveBeenCalledWith({
    apertureSettings: defaultApertureSettings,
    apertureDiameterMm: 6,
    diagnosticWavelengthNm: 550,
    showScaleBar: false,
    spectralMode: 'monochromatic',
    targetId: 'logmar_chart',
    wavefrontLegendUnit: 'wave',
    wavelengthWeights: [[550, 1]],
    zernikeCoefficientsByWavelength: [[550, expect.objectContaining({ '4,0': 2 })]]
  });
});

it('resets zernike textbox values to zero in the selected coefficient unit', async () => {
  const user = userEvent.setup();
  render(<App workerClient={createMockWorkerClient()} />);

  const sphericalCoefficient = screen.getByRole('textbox', {
    name: 'Primary Spherical Aberration Z(4,0) coefficient'
  });
  await user.click(screen.getByRole('button', { name: 'Micron' }));
  await user.clear(sphericalCoefficient);
  await user.type(sphericalCoefficient, '1.10');

  await user.click(screen.getByRole('button', { name: 'Reset aberrations' }));

  expect(sphericalCoefficient).toHaveValue('0.00');
  expect(screen.getByRole('button', { name: 'Micron' })).toHaveAttribute('aria-pressed', 'true');
});

it('commits valid zernike textbox values on blur to the worker payload', async () => {
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
    target: { value: '4.5' }
  });

  await act(async () => {
    await vi.advanceTimersByTimeAsync(600);
  });
  expect(computeConvolvedImage).not.toHaveBeenCalled();
  fireEvent.blur(sphericalCoefficient);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });

  expect(computeConvolvedImage).toHaveBeenCalledTimes(1);
  expect(computeConvolvedImage).toHaveBeenCalledWith({
    apertureSettings: defaultApertureSettings,
    apertureDiameterMm: 6,
    diagnosticWavelengthNm: 550,
    showScaleBar: false,
    spectralMode: 'monochromatic',
    targetId: 'logmar_chart',
    wavefrontLegendUnit: 'wave',
    wavelengthWeights: [[550, 1]],
    zernikeCoefficientsByWavelength: [[550, expect.objectContaining({ '4,0': 4.5 })]]
  });
});

it('commits valid zernike textbox values on Enter to the worker payload', async () => {
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
    target: { value: '3.25' }
  });

  await act(async () => {
    await vi.advanceTimersByTimeAsync(600);
  });
  expect(computeConvolvedImage).not.toHaveBeenCalled();
  fireEvent.keyDown(sphericalCoefficient, { key: 'Enter' });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });

  expect(computeConvolvedImage).toHaveBeenCalledTimes(1);
  expect(computeConvolvedImage).toHaveBeenCalledWith({
    apertureSettings: defaultApertureSettings,
    apertureDiameterMm: 6,
    diagnosticWavelengthNm: 550,
    showScaleBar: false,
    spectralMode: 'monochromatic',
    targetId: 'logmar_chart',
    wavefrontLegendUnit: 'wave',
    wavelengthWeights: [[550, 1]],
    zernikeCoefficientsByWavelength: [[550, expect.objectContaining({ '4,0': 3.25 })]]
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
    await vi.advanceTimersByTimeAsync(450);
  });
  expect(computeConvolvedImage).not.toHaveBeenCalled();

  fireEvent.change(sphericalCoefficient, {
    target: { value: '-' }
  });
  expect(sphericalCoefficient).toHaveValue('-');

  await act(async () => {
    await vi.advanceTimersByTimeAsync(450);
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
    target: { value: '5.01' }
  });
  expect(sphericalCoefficient).toHaveValue('5.01');
  expect(screen.getByText('Value must be between -5 and 5.')).toBeInTheDocument();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(450);
  });
  expect(computeConvolvedImage).not.toHaveBeenCalled();

  fireEvent.change(sphericalCoefficient, {
    target: { value: '-5.01' }
  });
  expect(sphericalCoefficient).toHaveValue('-5.01');
  expect(screen.getByText('Value must be between -5 and 5.')).toBeInTheDocument();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(450);
  });
  expect(computeConvolvedImage).not.toHaveBeenCalled();
});

it('keeps aperture typing out of the worker payload until blur commits it', async () => {
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

  fireEvent.change(screen.getByLabelText('Aperture Diameter (mm)'), {
    target: { value: '4' }
  });
  expect(screen.getByLabelText('Aperture Diameter (mm)')).toHaveValue('4');

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(computeConvolvedImage).not.toHaveBeenCalled();

  fireEvent.blur(screen.getByLabelText('Aperture Diameter (mm)'));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(299);
  });
  expect(computeConvolvedImage).not.toHaveBeenCalled();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(computeConvolvedImage).toHaveBeenCalledWith({
    apertureSettings: defaultApertureSettings,
    apertureDiameterMm: 4,
    diagnosticWavelengthNm: 550,
    showScaleBar: false,
    spectralMode: 'monochromatic',
    targetId: 'logmar_chart',
    wavefrontLegendUnit: 'wave',
    wavelengthWeights: [[550, 1]],
    zernikeCoefficientsByWavelength: [[550, expect.objectContaining({ '4,0': 0 })]]
  });
});

it('keeps aperture typing out of the worker payload until Enter commits it', async () => {
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

  fireEvent.change(screen.getByLabelText('Aperture Diameter (mm)'), {
    target: { value: '4' }
  });
  expect(screen.getByLabelText('Aperture Diameter (mm)')).toHaveValue('4');

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(computeConvolvedImage).not.toHaveBeenCalled();

  fireEvent.keyDown(screen.getByLabelText('Aperture Diameter (mm)'), { key: 'Enter' });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(299);
  });
  expect(computeConvolvedImage).not.toHaveBeenCalled();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(computeConvolvedImage).toHaveBeenCalledWith({
    apertureSettings: defaultApertureSettings,
    apertureDiameterMm: 4,
    diagnosticWavelengthNm: 550,
    showScaleBar: false,
    spectralMode: 'monochromatic',
    targetId: 'logmar_chart',
    wavefrontLegendUnit: 'wave',
    wavelengthWeights: [[550, 1]],
    zernikeCoefficientsByWavelength: [[550, expect.objectContaining({ '4,0': 0 })]]
  });
});

it('keeps keyboard slider movement out of the textbox until keyup, then commits once', async () => {
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

  const sphericalSlider = screen.getByRole('slider', {
    name: 'Primary Spherical Aberration Z(4,0) coefficient'
  });
  const sphericalCoefficient = screen.getByRole('textbox', {
    name: 'Primary Spherical Aberration Z(4,0) coefficient'
  });

  fireEvent.keyDown(sphericalSlider, { key: 'ArrowRight' });
  expect(sphericalCoefficient).toHaveValue('0.00');

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  expect(computeConvolvedImage).not.toHaveBeenCalled();

  fireEvent.keyUp(sphericalSlider, { key: 'ArrowRight' });
  expect(sphericalCoefficient).toHaveValue('0.05');
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });

  expect(computeConvolvedImage).toHaveBeenCalledTimes(1);
  expect(computeConvolvedImage).toHaveBeenCalledWith({
    apertureSettings: defaultApertureSettings,
    apertureDiameterMm: 6,
    diagnosticWavelengthNm: 550,
    showScaleBar: false,
    spectralMode: 'monochromatic',
    targetId: 'logmar_chart',
    wavefrontLegendUnit: 'wave',
    wavelengthWeights: [[550, 1]],
    zernikeCoefficientsByWavelength: [[550, expect.objectContaining({ '4,0': 0.05 })]]
  });
});

it('keeps pointer slider movement out of the textbox until release, then commits once', async () => {
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

  const sphericalSlider = screen.getByRole('slider', {
    name: 'Primary Spherical Aberration Z(4,0) coefficient'
  });
  const sphericalCoefficient = screen.getByRole('textbox', {
    name: 'Primary Spherical Aberration Z(4,0) coefficient'
  });
  const sphericalSliderRoot = sphericalSlider.closest('.MuiSlider-root') as HTMLElement;
  sphericalSliderRoot.getBoundingClientRect = vi.fn(() => ({
    bottom: 20,
    height: 20,
    left: 0,
    right: 200,
    top: 0,
    width: 200,
    x: 0,
    y: 0,
    toJSON: () => ({})
  }));

  fireEvent.touchStart(sphericalSliderRoot, {
    changedTouches: [{ clientX: 125, clientY: 10, identifier: 1 }]
  });
  expect(sphericalCoefficient).toHaveValue('0.00');

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  expect(computeConvolvedImage).not.toHaveBeenCalled();

  fireEvent.touchEnd(document, {
    changedTouches: [{ clientX: 125, clientY: 10, identifier: 1 }]
  });
  expect(sphericalCoefficient).toHaveValue('1.25');
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });

  expect(computeConvolvedImage).toHaveBeenCalledTimes(1);
  expect(computeConvolvedImage).toHaveBeenCalledWith({
    apertureSettings: defaultApertureSettings,
    apertureDiameterMm: 6,
    diagnosticWavelengthNm: 550,
    showScaleBar: false,
    spectralMode: 'monochromatic',
    targetId: 'logmar_chart',
    wavefrontLegendUnit: 'wave',
    wavelengthWeights: [[550, 1]],
    zernikeCoefficientsByWavelength: [[550, expect.objectContaining({ '4,0': 1.25 })]]
  });
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

  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.getByText('Preparing image...')).toBeInTheDocument();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  expect(computeConvolvedImage).toHaveBeenCalledWith({
    apertureSettings: defaultApertureSettings,
    apertureDiameterMm: 6,
    diagnosticWavelengthNm: 550,
    showScaleBar: false,
    spectralMode: 'monochromatic',
    targetId: 'logmar_chart',
    wavefrontLegendUnit: 'wave',
    wavelengthWeights: [[550, 1]],
    zernikeCoefficientsByWavelength: [
      [550, expect.objectContaining({
        '5,-5': 0,
        '6,0': 0,
        '4,0': 0
      })]
    ]
  });

  fireEvent.change(screen.getByLabelText('Aperture Diameter (mm)'), {
    target: { value: '4' }
  });
  fireEvent.blur(screen.getByLabelText('Aperture Diameter (mm)'));
  fireEvent.change(screen.getByLabelText('Target'), {
    target: { value: 'logmar_chart' }
  });
  fireEvent.keyDown(screen.getByRole('slider', { name: 'Defocus Z(2,0) coefficient' }), {
    key: 'ArrowRight'
  });
  fireEvent.keyUp(screen.getByRole('slider', { name: 'Defocus Z(2,0) coefficient' }), {
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
    apertureSettings: defaultApertureSettings,
    apertureDiameterMm: 4,
    diagnosticWavelengthNm: 550,
    showScaleBar: false,
    spectralMode: 'monochromatic',
    targetId: 'logmar_chart',
    wavefrontLegendUnit: 'wave',
    wavelengthWeights: [[550, 1]],
    zernikeCoefficientsByWavelength: [
      [550, expect.objectContaining({
        '2,0': 0.05,
        '4,0': 0
      })]
    ]
  });
});

it('sends enabled scale bar preference to the worker payload', async () => {
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

  fireEvent.click(screen.getByRole('button', { name: 'Setting' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Show scale bar' }));

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });

  expect(computeConvolvedImage).toHaveBeenCalledWith({
    apertureSettings: defaultApertureSettings,
    apertureDiameterMm: 6,
    diagnosticWavelengthNm: 550,
    showScaleBar: true,
    spectralMode: 'monochromatic',
    targetId: 'logmar_chart',
    wavefrontLegendUnit: 'wave',
    wavelengthWeights: [[550, 1]],
    zernikeCoefficientsByWavelength: [[550, expect.objectContaining({ '4,0': 0 })]]
  });
});

it('sends selected wavefront legend unit to the worker payload', async () => {
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

  fireEvent.click(screen.getByRole('button', { name: 'Setting' }));
  fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

  const wavefrontLegendMicronButton = screen
    .getAllByRole('button', { name: 'Micron' })
    .find((button) => !button.hasAttribute('aria-pressed'));
  expect(wavefrontLegendMicronButton).toBeDefined();
  fireEvent.click(wavefrontLegendMicronButton as HTMLButtonElement);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });

  expect(computeConvolvedImage).toHaveBeenCalledWith({
    apertureSettings: defaultApertureSettings,
    apertureDiameterMm: 6,
    diagnosticWavelengthNm: 550,
    showScaleBar: false,
    spectralMode: 'monochromatic',
    targetId: 'logmar_chart',
    wavefrontLegendUnit: 'micron',
    wavelengthWeights: [[550, 1]],
    zernikeCoefficientsByWavelength: [[550, expect.objectContaining({ '4,0': 0 })]]
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

  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.getByText('Preparing image...')).toBeInTheDocument();
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

it('hides stale chart images while a later image render is pending', async () => {
  vi.useFakeTimers();
  let resolveSecondCompute: (result: ConvolvedImageResult) => void = () => {};
  const computeConvolvedImage = vi
    .fn()
    .mockResolvedValueOnce({
      imageUrl: 'data:image/png;base64,bG9nbWFy',
      psfImageUrl: 'data:image/png;base64,cHNm',
      wavefrontImageUrl: 'data:image/png;base64,d2F2ZWZyb250',
      diagnostics: {
        status: 'ready',
        message: 'Mock worker ready'
      }
    } satisfies ConvolvedImageResult)
    .mockImplementationOnce(
      () =>
        new Promise<ConvolvedImageResult>((resolve) => {
          resolveSecondCompute = resolve;
        })
    );

  render(<App workerClient={createMockWorkerClient({ computeConvolvedImage })} />);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  expect(screen.getByAltText('Convolved simulated target')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Target'), {
    target: { value: 'siemensstar' }
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });

  expect(screen.getByText('Preparing image...')).toBeInTheDocument();
  expect(screen.queryByAltText('Convolved simulated target')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Open enlarged Simulated Image image' })
  ).not.toBeInTheDocument();

  await act(async () => {
    resolveSecondCompute({
      imageUrl: 'data:image/png;base64,c2llbWVuc3N0YXI=',
      psfImageUrl: 'data:image/png;base64,c2llbWVuc3N0YXItcHNm',
      wavefrontImageUrl: 'data:image/png;base64,c2llbWVuc3N0YXItd2F2ZWZyb250',
      diagnostics: {
        status: 'ready',
        message: 'Mock worker ready'
      }
    });
  });

  expect(screen.getByAltText('Convolved simulated target')).toBeInTheDocument();
});

it('opens and closes an enlarged preview from the simulated image', async () => {
  vi.useFakeTimers();
  render(<App workerClient={createMockWorkerClient()} />);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });

  fireEvent.click(
    screen.getByRole('button', { name: 'Open enlarged Simulated Image image' })
  );

  const preview = screen.getByRole('dialog', { name: 'Simulated Image enlarged image' });
  expect(preview).toBeInTheDocument();
  expect(preview).toHaveStyle({
    backgroundColor: 'rgb(245, 246, 241)'
  });
  expect(preview).toContainElement(screen.getAllByAltText('Convolved simulated target')[1]);
  const closeButton = screen.getByRole('button', { name: 'Close enlarged image' });
  expect(closeButton).toHaveClass('MuiButton-contained');
  expect(closeButton).toHaveClass('MuiButton-colorPrimary');
  expect(closeButton).not.toHaveStyle({
    backgroundColor: 'rgb(255, 255, 255)'
  });

  fireEvent.click(preview);
  expect(
    screen.queryByRole('dialog', { name: 'Simulated Image enlarged image' })
  ).not.toBeInTheDocument();

  fireEvent.click(
    screen.getByRole('button', { name: 'Open enlarged Simulated Image image' })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Close enlarged image' }));
  expect(
    screen.queryByRole('dialog', { name: 'Simulated Image enlarged image' })
  ).not.toBeInTheDocument();
});

it('opens enlarged previews from advanced PSF and wavefront images', async () => {
  render(<App workerClient={createMockWorkerClient()} />);

  await screen.findByRole('button', { name: 'Open enlarged Simulated Image image' });

  fireEvent.click(screen.getByRole('button', { name: 'Setting' }));
  fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

  fireEvent.click(screen.getByRole('button', { name: 'Open enlarged PSF image' }));
  expect(screen.getByRole('dialog', { name: 'PSF enlarged image' })).toContainElement(
    screen.getAllByAltText('Rendered point spread function')[1]
  );
  fireEvent.keyDown(screen.getByRole('dialog', { name: 'PSF enlarged image' }), {
    key: 'Escape'
  });
  expect(
    screen.queryByRole('dialog', { name: 'PSF enlarged image' })
  ).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Open enlarged Wavefront Map image' }));
  expect(screen.getByRole('dialog', { name: 'Wavefront Map enlarged image' })).toContainElement(
    screen.getAllByAltText('Rendered wavefront map')[1]
  );
});

it('does not expose image preview buttons for loading and error placeholders', async () => {
  vi.useFakeTimers();
  const computeConvolvedImage = vi.fn().mockRejectedValue(new Error('Simulation exploded'));

  render(<App workerClient={createMockWorkerClient({ computeConvolvedImage })} />);

  expect(
    screen.queryByRole('button', { name: 'Open enlarged Simulated Image image' })
  ).not.toBeInTheDocument();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });

  expect(screen.getByText('Simulation exploded')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Open enlarged Simulated Image image' })
  ).not.toBeInTheDocument();
});

it('shows PSF and wavefront cards in advanced display mode', async () => {
  const user = userEvent.setup();
  setMatchesSm(true);
  render(<App workerClient={createMockWorkerClient()} />);

  expect(screen.getByRole('heading', { name: 'Simulated Image' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'PSF' })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Wavefront Map' })).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Setting' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  await user.keyboard('{Escape}');

  expect(screen.getByRole('heading', { name: 'PSF' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Wavefront Map' })).toBeInTheDocument();

  const simulatedImageCard = screen
    .getByRole('heading', { name: 'Simulated Image' })
    .closest('.MuiCard-root');
  const psfCard = screen.getByRole('heading', { name: 'PSF' }).closest('.MuiCard-root');
  const wavefrontCard = screen
    .getByRole('heading', { name: 'Wavefront Map' })
    .closest('.MuiCard-root');
  expect(psfCard).toBe(simulatedImageCard);
  expect(wavefrontCard).toBe(simulatedImageCard);

  const psfDetails = screen.getByText(psfCutoffNote).closest('.MuiAccordionDetails-root');
  expect(psfDetails).not.toBeNull();
  expect(within(psfDetails as HTMLElement).getByText(psfCutoffNote)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'PSF' })).toHaveAttribute('aria-expanded', 'true');

  fireEvent.change(screen.getByLabelText('Target'), {
    target: { value: 'siemensstar' }
  });

  expect(within(psfDetails as HTMLElement).queryByText(psfCutoffNote)).not.toBeInTheDocument();
});

it('shows the legend unit selector at the bottom of the wavefront map card in advanced display mode', async () => {
  const user = userEvent.setup();
  setMatchesSm(true);
  render(<App workerClient={createMockWorkerClient()} />);

  expect(screen.queryByText('Legend Unit')).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Setting' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  await user.keyboard('{Escape}');

  const wavefrontDescription = screen.getByText(
    'The rendered wavefront map for the current Zernike aberration values.'
  );
  const wavefrontCardContent = wavefrontDescription.closest('.MuiAccordionDetails-root');
  expect(wavefrontCardContent).not.toBeNull();

  const wavefrontCard = within(wavefrontCardContent as HTMLElement);
  expect(wavefrontCard.getByText('Legend Unit')).toBeInTheDocument();
  expect(wavefrontCard.getByRole('button', { name: 'Wave' })).toHaveClass('MuiButton-contained');
  expect(wavefrontCard.getByRole('button', { name: 'Micron' })).toBeInTheDocument();
});

it('hides the PSF card for point source targets in advanced display mode', async () => {
  const user = userEvent.setup();
  setMatchesSm(true);
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

  const simulatedImageCard = screen
    .getByRole('heading', { name: 'Simulated Image' })
    .closest('.MuiCard-root');
  const wavefrontCard = screen
    .getByRole('heading', { name: 'Wavefront Map' })
    .closest('.MuiCard-root');
  expect(wavefrontCard).toBe(simulatedImageCard);
});

it('keeps advanced result panels in separate cards on extra-small screens', async () => {
  const user = userEvent.setup();
  setMatchesSm(false);
  render(<App workerClient={createMockWorkerClient()} />);

  await user.click(screen.getByRole('button', { name: 'Setting' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  await user.keyboard('{Escape}');

  const simulatedImageCard = screen
    .getByRole('heading', { name: 'Simulated Image' })
    .closest('.MuiCard-root');
  const psfCard = screen.getByRole('heading', { name: 'PSF' }).closest('.MuiCard-root');
  const wavefrontCard = screen
    .getByRole('heading', { name: 'Wavefront Map' })
    .closest('.MuiCard-root');

  expect(psfCard).not.toBe(simulatedImageCard);
  expect(wavefrontCard).not.toBe(simulatedImageCard);
  expect(wavefrontCard).not.toBe(psfCard);
});
