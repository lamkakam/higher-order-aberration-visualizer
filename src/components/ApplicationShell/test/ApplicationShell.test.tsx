import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Router } from 'wouter';
import { ApplicationShell } from '../ApplicationShell';
import i18n, { cachedLanguageKey } from '../../../i18n';
import { createMockWorkerClient } from '../../../test/workerMock';
import type {
  ApertureMaskResult,
  ConvolvedImageInput,
  ConvolvedImageResult
} from '../../../workers/types';

const psfCutoffNote =
  'The PSF chart may show a clear intensity cutoff around the central region. This limit is intentional: it keeps chart generation responsive while reducing memory use and computational cost, without changing the underlying optical simulation.';
const enlargementHint = 'Click the image to view it enlarged.';
const termsAcceptedStorageKey = 'hoaTermsOfUseAccepted';
const termsLinkHref =
  'https://redirect.github.com/lamkakam/higher-order-aberration-visualizer/blob/main/LICENSE';
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
    name: 'Vane Width (times Aperture Diameter)'
  });
}

function getSpiderVaneWidthSlider(container: HTMLElement = document.body) {
  return within(container).getByRole('slider', {
    name: 'Vane Width (times Aperture Diameter)'
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
    name: 'Standard Deviation (times Aperture Diameter)'
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

beforeEach(() => {
  window.localStorage.setItem(termsAcceptedStorageKey, 'true');
});

afterEach(async () => {
  await i18n.changeLanguage('en');
  setPath('/');
  window.localStorage.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function setNavigatorLanguages(language: string, languages: readonly string[]) {
  vi.stubGlobal('navigator', {
    ...window.navigator,
    language,
    languages
  });
}

function setPath(path: string) {
  window.history.pushState(undefined, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function renderAtPath(path: string) {
  setPath(path);
  return render(<ApplicationShell workerClient={createMockWorkerClient()} />);
}

function renderAtPathWithRouterBase(path: string, base: string) {
  setPath(path);
  return render(
    <Router base={base}>
      <ApplicationShell workerClient={createMockWorkerClient()} />
    </Router>
  );
}

async function openSettingsDrawer() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /^(Settings|設定|设置)$/ }));
}

function getSettingsLanguageSelect(label?: string) {
  if (label !== undefined) {
    return screen.getByRole('combobox', { name: label });
  }

  return within(screen.getByRole('dialog')).getByRole('combobox', {
    name: /^(Language|語言|语言)$/
  });
}

it('shows the terms of use modal on first render until the user agrees', async () => {
  const user = userEvent.setup();
  window.localStorage.removeItem(termsAcceptedStorageKey);
  renderAtPath('/');

  const modal = await screen.findByRole('dialog', { name: 'Terms of Use' });
  expect(within(modal).getByText('Terms of Use')).toBeInTheDocument();
  expect(within(modal).getByRole('button', { name: 'Agree' })).toBeInTheDocument();

  fireEvent.keyDown(modal, { key: 'Escape' });
  expect(screen.getByRole('dialog', { name: 'Terms of Use' })).toBeInTheDocument();

  const backdrop = document.querySelector('.MuiBackdrop-root') as HTMLElement;
  fireEvent.click(backdrop);
  expect(screen.getByRole('dialog', { name: 'Terms of Use' })).toBeInTheDocument();
  expect(within(modal).queryByRole('button', { name: /cancel|close/i })).not.toBeInTheDocument();

  await user.click(within(modal).getByRole('button', { name: 'Agree' }));

  expect(screen.queryByRole('dialog', { name: 'Terms of Use' })).not.toBeInTheDocument();
});

it('stores terms of use agreement in localStorage when the user agrees', async () => {
  const user = userEvent.setup();
  window.localStorage.removeItem(termsAcceptedStorageKey);
  renderAtPath('/');

  await user.click(await screen.findByRole('button', { name: 'Agree' }));

  expect(window.localStorage.getItem(termsAcceptedStorageKey)).toBe('true');
});

it('does not show the terms of use modal when agreement is already stored', () => {
  renderAtPath('/');

  expect(screen.queryByRole('dialog', { name: 'Terms of Use' })).not.toBeInTheDocument();
});

it('opens the full terms link in a new tab through the GitHub redirect domain', async () => {
  window.localStorage.removeItem(termsAcceptedStorageKey);
  renderAtPath('/');

  const modal = await screen.findByRole('dialog', { name: 'Terms of Use' });
  const link = within(modal).getByRole('link', { name: 'full terms' });

  expect(link).toHaveAttribute('href', termsLinkHref);
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noreferrer');
});

it('renders the header and settings drawer theme controls', async () => {
  renderAtPath('/');

  const banner = screen.getByRole('banner');
  const appTitle = within(banner).getByText('Higher-Order Aberration Simulator');

  expect(appTitle).toBeInTheDocument();
  expect(appTitle.tagName).toBe('P');
  expect(within(banner).queryByText('Simulator')).not.toBeInTheDocument();
  expect(within(screen.getByRole('banner')).queryByRole('combobox')).not.toBeInTheDocument();

  await openSettingsDrawer();

  expect(getSettingsLanguageSelect('Language')).toHaveValue('en');
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

it('shows the analysis image in advanced display selector only in advanced mode', async () => {
  renderAtPath('/en/basic');

  await openSettingsDrawer();
  expect(
    screen.queryByRole('combobox', { name: 'Analysis Image in Advanced Display' })
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));

  expect(screen.getByRole('combobox', { name: 'Analysis Image in Advanced Display' })).toHaveValue(
    'wavefront_map'
  );
  expect(screen.getByRole('option', { name: 'Wavefront Map' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'MTF' })).toBeInTheDocument();
});

it('switches the analysis image in advanced display to MTF without recomputing', async () => {
  vi.useFakeTimers();
  const computeConvolvedImage = vi.fn(
    async (input: ConvolvedImageInput): Promise<ConvolvedImageResult> => ({
      imageUrl: `data:image/png;base64,${window.btoa(input.targetId)}`,
      psfImageUrl: `data:image/png;base64,${window.btoa(`${input.targetId}-psf`)}`,
      wavefrontImageUrl: `data:image/png;base64,${window.btoa(`${input.targetId}-wavefront`)}`,
      mtfImageUrl: `data:image/png;base64,${window.btoa(`${input.targetId}-mtf`)}`,
      diagnostics: {
        status: 'ready',
        message: 'Mock worker ready'
      }
    })
  );
  render(<ApplicationShell workerClient={createMockWorkerClient({ computeConvolvedImage })} />);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  computeConvolvedImage.mockClear();

  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Analysis Image in Advanced Display' }), {
    target: { value: 'mtf' }
  });
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

  expect(screen.getByRole('heading', { name: 'MTF' })).toBeInTheDocument();
  expect(
    screen.getByText('The modulation transfer function for the current optical system.', { exact: false })
  ).toBeInTheDocument();
  expect(screen.getByAltText('Rendered modulation transfer function plot')).toHaveAttribute(
    'src',
    'data:image/png;base64,bG9nbWFyX2NoYXJ0LW10Zg=='
  );
  expect(screen.queryByText('Legend Unit')).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Open enlarged MTF image' })
  ).toBeInTheDocument();
  expect(computeConvolvedImage).not.toHaveBeenCalled();
});

it('renders language as the first settings control and supports explicit languages', async () => {
  const changeLanguage = vi.spyOn(i18n, 'changeLanguage');
  renderAtPath('/');

  await openSettingsDrawer();

  const languageLabel = screen.getByText('Language', { selector: 'label' });
  const languageSelect = getSettingsLanguageSelect('Language');
  const modeLabel = screen.getByText('Mode');

  expect(languageSelect).toHaveAttribute('id');
  expect(languageLabel).toHaveAttribute('for', languageSelect.id);
  expect(
    languageLabel.compareDocumentPosition(languageSelect) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  expect(languageSelect).toHaveValue('en');
  expect(screen.queryByRole('option', { name: 'Browser default' })).not.toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'English' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: '繁體中文' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: '简体中文' })).toBeInTheDocument();
  expect(
    languageSelect.compareDocumentPosition(modeLabel) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();

  fireEvent.change(languageSelect, { target: { value: 'zh-Hans' } });

  expect(changeLanguage).toHaveBeenCalledWith('zh-Hans');
  changeLanguage.mockRestore();
  expect(languageSelect).toHaveValue('zh-Hans');
});

it.each([
  ['/en/basic', 'en', false],
  ['/en/advanced', 'en', true],
  ['/zh-Hant/basic', 'zh-Hant', false],
  ['/zh-Hans/advanced', 'zh-Hans', true]
])('renders route %s with language %s and advanced mode %s', async (path, language, isAdvanced) => {
  renderAtPath(path);

  if (isAdvanced) {
    const psfHeading = language === 'zh-Hans' ? '点扩散函数' : 'PSF';
    expect(await screen.findByRole('heading', { name: psfHeading })).toBeInTheDocument();
  } else {
    expect(screen.queryByRole('heading', { name: 'PSF' })).not.toBeInTheDocument();
  }

  await openSettingsDrawer();

  await waitFor(() => {
    expect(getSettingsLanguageSelect()).toHaveValue(language);
  });
});

it('renders a GitHub Pages route under the deployment base path', async () => {
  renderAtPathWithRouterBase(
    '/higher-order-aberration-visualizer/en/advanced',
    '/higher-order-aberration-visualizer'
  );

  expect(await screen.findByRole('heading', { name: 'PSF' })).toBeInTheDocument();
  await openSettingsDrawer();

  await waitFor(() => {
    expect(getSettingsLanguageSelect()).toHaveValue('en');
  });
  expect(window.location.pathname).toBe('/higher-order-aberration-visualizer/en/advanced');
});

it('normalizes the root route to the detected language and basic mode', async () => {
  setNavigatorLanguages('zh-TW', ['zh-TW']);

  renderAtPath('/');

  await waitFor(() => {
    expect(window.location.pathname).toBe('/zh-Hant/basic');
  });
  await openSettingsDrawer();
  expect(getSettingsLanguageSelect('語言')).toHaveValue('zh-Hant');
  expect(screen.queryByRole('heading', { name: 'PSF' })).not.toBeInTheDocument();
});

it('normalizes the GitHub Pages base route to the detected language and basic mode', async () => {
  setNavigatorLanguages('zh-TW', ['zh-TW']);

  renderAtPathWithRouterBase(
    '/higher-order-aberration-visualizer/',
    '/higher-order-aberration-visualizer'
  );

  await waitFor(() => {
    expect(window.location.pathname).toBe('/higher-order-aberration-visualizer/zh-Hant/basic');
  });
  await openSettingsDrawer();
  expect(getSettingsLanguageSelect('語言')).toHaveValue('zh-Hant');
  expect(screen.queryByRole('heading', { name: 'PSF' })).not.toBeInTheDocument();
});

it('normalizes invalid route state to the detected language and basic mode', async () => {
  setNavigatorLanguages('zh-CN', ['zh-CN']);

  renderAtPath('/fr/unknown');

  await waitFor(() => {
    expect(window.location.pathname).toBe('/zh-Hans/basic');
  });
  await openSettingsDrawer();
  expect(getSettingsLanguageSelect('语言')).toHaveValue('zh-Hans');
  expect(screen.queryByRole('heading', { name: 'PSF' })).not.toBeInTheDocument();
});

it('uses cached supported language before checking browser languages', async () => {
  window.localStorage.setItem(cachedLanguageKey, 'zh-Hans');
  setNavigatorLanguages('en-US', ['en-US']);

  renderAtPath('/');
  await openSettingsDrawer();

  await waitFor(() => {
    expect(getSettingsLanguageSelect()).toHaveValue('zh-Hans');
  });
});

it.each([
  ['en-US', 'en'],
  ['zh-Hant', 'zh-Hant'],
  ['zh-TW', 'zh-Hant'],
  ['zh-HK', 'zh-Hant'],
  ['zh-MO', 'zh-Hant']
])('matches browser language variant %s to supported language %s', async (browserLanguage, expected) => {
  setNavigatorLanguages(browserLanguage, [browserLanguage]);

  renderAtPath('/');
  await openSettingsDrawer();

  await waitFor(() => {
    expect(getSettingsLanguageSelect()).toHaveValue(expected);
  });
});

it.each([
  ['zh-Hans', 'zh-Hans'],
  ['zh-CN', 'zh-Hans'],
  ['zh-SG', 'zh-Hans'],
  ['zh', 'zh-Hans']
])('matches browser language variant %s to supported language %s', async (browserLanguage, expected) => {
  setNavigatorLanguages(browserLanguage, [browserLanguage]);

  renderAtPath('/');
  await openSettingsDrawer();

  await waitFor(() => {
    expect(getSettingsLanguageSelect()).toHaveValue(expected);
  });
});

it.each(['fr-FR'])(
  'falls back to English for unsupported browser language %s',
  async (browserLanguage) => {
    setNavigatorLanguages(browserLanguage, [browserLanguage]);

    renderAtPath('/');
    await openSettingsDrawer();

    expect(getSettingsLanguageSelect('Language')).toHaveValue('en');
  }
);

it('renders core UI text through the English translation file', async () => {
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

  expect(screen.getByRole('heading', { name: 'Optical System Config' })).toBeInTheDocument();
  expect(screen.getByLabelText('Aperture Diameter (mm)')).toHaveValue('6');
  expect(screen.getByRole('heading', { name: 'Optical Aberrations (Zernike)' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Reset aberrations' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Simulated Image' })).toBeInTheDocument();
});

it('renders representative core UI text through the Traditional Chinese translation file', async () => {
  renderAtPath('/zh-Hant/basic');

  expect(await screen.findByRole('heading', { name: '光學系統設定' })).toBeInTheDocument();
  expect(screen.getByLabelText('口徑 (mm)')).toHaveValue('6');
  expect(screen.getByRole('heading', { name: '光學像差 (Zernike)' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '重設像差' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '模擬影像' })).toBeInTheDocument();
});

it('keeps Traditional Chinese settings mode labels on one line', async () => {
  renderAtPath('/zh-Hant/basic');

  await openSettingsDrawer();

  const modeLabel = screen.getByText('模式');
  const drawerContent = modeLabel.parentElement;

  expect(drawerContent).toHaveStyle({
    width: '320px',
    boxSizing: 'border-box'
  });
  expect(screen.getByRole('button', { name: '淺色' })).toHaveStyle({ whiteSpace: 'nowrap' });
  expect(screen.getByRole('button', { name: '系統設定' })).toHaveStyle({ whiteSpace: 'nowrap' });
  expect(screen.getByRole('button', { name: '深色' })).toHaveStyle({ whiteSpace: 'nowrap' });
});

it('renders representative core UI text through the Simplified Chinese translation file', async () => {
  renderAtPath('/zh-Hans/basic');

  expect(await screen.findByRole('heading', { name: '光学系统配置' })).toBeInTheDocument();
  expect(await screen.findByLabelText('口径 (mm)')).toHaveValue('6');
  expect(screen.getByRole('heading', { name: '光学像差 (泽尼克)' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '重置像差' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '模拟图像' })).toBeInTheDocument();
});

it('shows an app-level initialization mask while the worker initializes', async () => {
  let resolveInitialize: (diagnostics: ConvolvedImageResult['diagnostics']) => void = () => {};
  const initialize = vi.fn(
    () =>
      new Promise<ConvolvedImageResult['diagnostics']>((resolve) => {
        resolveInitialize = resolve;
      })
  );
  const getStatus = vi.fn(async () => ({
    status: 'initializing' as const,
    message: 'Loading Pyodide',
    messageKey: 'status.worker.loadingPyodide' as const,
    progressPercent: 20
  }));

  render(<ApplicationShell workerClient={createMockWorkerClient({ initialize, getStatus })} />);

  expect(screen.getByRole('status', { name: 'Worker initialization' })).toBeInTheDocument();
  expect(screen.getByText('Initializing...')).toBeInTheDocument();
  expect(await screen.findByText('Loading Pyodide')).toBeInTheDocument();
  expect(screen.getByText('20%')).toBeInTheDocument();
  expect(screen.getByRole('progressbar', { name: 'Initialization progress' })).toHaveAttribute(
    'aria-valuenow',
    '20'
  );

  await act(async () => {
    resolveInitialize({
      status: 'ready',
      message: 'Mock worker ready',
      progressPercent: 100
    });
  });

  expect(screen.queryByRole('status', { name: 'Worker initialization' })).not.toBeInTheDocument();
  expect(screen.queryByText('Initializing...')).not.toBeInTheDocument();
});

it('renders default aperture and supported target options', async () => {
  const user = userEvent.setup();
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

  const opticalSystemSummary = screen.getByRole('button', { name: 'Optical System Config' });
  const opticalSystemAccordion = opticalSystemSummary.closest('.MuiAccordion-root');

  expect(opticalSystemSummary).toHaveAttribute('aria-expanded', 'true');
  expect(opticalSystemSummary).toHaveStyle({
    backgroundColor: 'rgb(255, 255, 255)'
  });
  expect(opticalSystemAccordion).toHaveStyle({
    overflow: 'hidden'
  });
  expect(screen.getByLabelText('Aperture Diameter (mm)')).toHaveValue('6');
  expect(screen.getByText('Aperture Diameter (mm)', { selector: 'label' })).toHaveAttribute(
    'for',
    screen.getByLabelText('Aperture Diameter (mm)').id
  );
  expect(screen.getByLabelText('Aperture Diameter (mm)')).toHaveAttribute('autocomplete', 'off');
  expect(screen.queryByText('Minimum value is 0.5.')).not.toBeInTheDocument();

  await user.click(screen.getByLabelText('Target'));

  expect(screen.getByText('Target', { selector: 'label' })).toHaveAttribute('for', 'target-select');
  expect(screen.getByLabelText('Target')).toHaveAttribute('id', 'target-select');

  const targetOptions = within(screen.getByLabelText('Target')).getAllByRole('option');
  expect(targetOptions[0]).toHaveTextContent('Eye Chart (logMAR)');
  expect(targetOptions[0]).toHaveValue('logmar_chart');
  expect(screen.getByRole('option', { name: 'Eye Chart (logMAR)' })).toBeInTheDocument();
  expect(
    screen.getByRole('option', { name: 'Eye Chart (logMAR, Reverse Contrast)' })
  ).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Snellen Chart Letter E on 20/20' })).toBeInTheDocument();
  expect(
    screen.getByRole('option', {
      name: 'Snellen Chart Letter E on 20/20 (Reverse Contrast)'
    })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('option', { name: 'Jupiter (angular diameter 50 arcsecond)' })
  ).toHaveValue('jupiter');
  expect(screen.getByRole('option', { name: 'Point Source (Airy Disc)' })).toBeInTheDocument();
  expect(targetOptions[6]).toHaveTextContent('Point Source (Airy Disc) for Star Test');
  expect(targetOptions[6]).toHaveValue('wide_point_source');
  expect(screen.getByRole('option', { name: 'Siemens Star' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Slanted Edge' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Tilted Square' })).toBeInTheDocument();
});

it('renders the star-test point source label in Chinese locales', () => {
  renderAtPath('/zh-Hans/basic');

  expect(screen.getByRole('option', { name: '点光源 (用于星点测试)' })).toHaveValue(
    'wide_point_source'
  );
});

it('shows aperture mask controls only in advanced mode', async () => {
  const user = userEvent.setup();
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

  expect(screen.queryByRole('button', { name: 'Edit aperture mask' })).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Settings' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

  expect(screen.getByRole('button', { name: 'Edit aperture mask' })).toBeInTheDocument();
  expect(screen.getByText('Aperture Mask')).toBeInTheDocument();
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
  render(<ApplicationShell workerClient={createMockWorkerClient({ renderApertureMask })} />);

  await user.click(screen.getByRole('button', { name: 'Settings' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await user.click(screen.getByRole('button', { name: 'Edit aperture mask' }));

  const modal = screen.getByRole('dialog', { name: 'Aperture Mask' });
  expect(within(modal).getByLabelText('Aperture Shape')).toHaveValue('circle');
  expect(within(modal).getByText('Aperture Shape', { selector: 'label' })).toHaveAttribute(
    'for',
    within(modal).getByLabelText('Aperture Shape').id
  );
  expect(within(modal).getByText('Aperture Shape', { selector: 'label' })).not.toHaveClass(
    'MuiInputLabel-root'
  );
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
      name: 'Standard Deviation (times Aperture Diameter)'
    })
  ).not.toBeInTheDocument();
  expect(within(modal).queryByRole('slider', { name: 'Aperture Rotation' })).not.toBeInTheDocument();
  expect(within(modal).queryByLabelText('Obstruction Shape')).not.toBeInTheDocument();
  expect(within(modal).getByText('Preview')).toBeInTheDocument();
  expect(within(modal).getByText('Preparing aperture mask preview...')).toBeInTheDocument();
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
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

  await user.click(screen.getByRole('button', { name: 'Settings' }));
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
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

  await user.click(screen.getByRole('button', { name: 'Settings' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await user.click(screen.getByRole('button', { name: 'Edit aperture mask' }));

  const modal = screen.getByRole('dialog', { name: 'Aperture Mask' });
  expect(getGaussianApodizationSwitch(modal)).not.toBeChecked();
  expect(
    within(modal).queryByRole('textbox', {
      name: 'Standard Deviation (times Aperture Diameter)'
    })
  ).not.toBeInTheDocument();

  await user.click(getGaussianApodizationSwitch(modal));

  expect(getGaussianApodizationSwitch(modal)).toBeChecked();
  expect(
    within(modal).getByRole('slider', {
      name: 'Standard Deviation (times Aperture Diameter)'
    })
  ).toBeInTheDocument();
  expect(getGaussianSigmaRatioTextbox(modal)).toHaveValue('0.5');
});

it('shows aperture shape controls conditionally in the aperture mask modal', async () => {
  const user = userEvent.setup();
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

  await user.click(screen.getByRole('button', { name: 'Settings' }));
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
  expect(within(modal).getByText('Obstruction Shape', { selector: 'label' })).toHaveAttribute(
    'for',
    within(modal).getByLabelText('Obstruction Shape').id
  );
  expect(within(modal).getByText('Obstruction Shape', { selector: 'label' })).not.toHaveClass(
    'MuiInputLabel-root'
  );
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
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

  await user.click(screen.getByRole('button', { name: 'Settings' }));
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

it('commits aperture mask spinner steps and disables boundary buttons', async () => {
  const user = userEvent.setup();
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

  await user.click(screen.getByRole('button', { name: 'Settings' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await user.click(screen.getByRole('button', { name: 'Edit aperture mask' }));

  const modal = screen.getByRole('dialog', { name: 'Aperture Mask' });
  expect(within(modal).getByRole('button', { name: 'Decrease Central Obstruction Ratio' })).toBeDisabled();
  await user.click(within(modal).getByRole('button', { name: 'Increase Central Obstruction Ratio' }));
  expect(getCentralObstructionRatioTextbox(modal)).toHaveValue('0.01');
  await user.click(within(modal).getByRole('button', { name: 'Decrease Central Obstruction Ratio' }));
  expect(getCentralObstructionRatioTextbox(modal)).toHaveValue('0');

  await user.click(within(modal).getByRole('button', { name: 'Increase Spider Vanes' }));
  expect(getSpiderVanesTextbox(modal)).toHaveValue('1');
  await user.click(within(modal).getByRole('button', { name: 'Decrease Spider Vanes' }));
  expect(getSpiderVanesTextbox(modal)).toHaveValue('0');
  expect(within(modal).getByRole('button', { name: 'Decrease Spider Vanes' })).toBeDisabled();

  await user.click(within(modal).getByRole('button', { name: 'Increase Vane Width (times Aperture Diameter)' }));
  expect(getSpiderVaneWidthTextbox(modal)).toHaveValue('0.01');

  await user.click(getGaussianApodizationSwitch(modal));
  await user.click(
    within(modal).getByRole('button', {
      name: 'Increase Standard Deviation (times Aperture Diameter)'
    })
  );
  expect(getGaussianSigmaRatioTextbox(modal)).toHaveValue('0.51');

  fireEvent.change(getSpiderVaneRotationTextbox(modal), {
    target: { value: '360' }
  });
  fireEvent.blur(getSpiderVaneRotationTextbox(modal));
  expect(within(modal).getByRole('button', { name: 'Increase Vane Rotation' })).toBeDisabled();
});

it('commits aperture rotation textbox values to the confirmed payload', async () => {
  vi.useFakeTimers();
  const computeConvolvedImage = vi.fn(
    async (input: ConvolvedImageInput): Promise<ConvolvedImageResult> => ({
      imageUrl: `data:image/png;base64,${window.btoa(input.targetId)}`,
      psfImageUrl: `data:image/png;base64,${window.btoa(`${input.targetId}-psf`)}`,
      wavefrontImageUrl: `data:image/png;base64,${window.btoa(`${input.targetId}-wavefront`)}`,
      mtfImageUrl: 'data:image/png;base64,bXRm',
      diagnostics: {
        status: 'ready',
        message: 'Mock worker ready'
      }
    })
  );

  render(<ApplicationShell workerClient={createMockWorkerClient({ computeConvolvedImage })} />);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  computeConvolvedImage.mockClear();

  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
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
  render(<ApplicationShell workerClient={createMockWorkerClient({ renderApertureMask })} />);

  await user.click(screen.getByRole('button', { name: 'Settings' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await user.click(screen.getByRole('button', { name: 'Edit aperture mask' }));

  const panel = screen.getByTestId('aperture-mask-preview-panel');
  expect(panel).toHaveStyle({ height: '280px', minHeight: '280px' });
  expect(within(panel).getByText('Preparing aperture mask preview...')).toBeInTheDocument();

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
      mtfImageUrl: 'data:image/png;base64,bXRm',
      diagnostics: {
        status: 'ready',
        message: 'Mock worker ready'
      }
    })
  );

  render(<ApplicationShell workerClient={createMockWorkerClient({ computeConvolvedImage })} />);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  computeConvolvedImage.mockClear();

  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
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
      mtfImageUrl: 'data:image/png;base64,bXRm',
      diagnostics: {
        status: 'ready',
        message: 'Mock worker ready'
      }
    })
  );

  render(<ApplicationShell workerClient={createMockWorkerClient({ computeConvolvedImage })} />);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  computeConvolvedImage.mockClear();

  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
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
      mtfImageUrl: 'data:image/png;base64,bXRm',
      diagnostics: {
        status: 'ready',
        message: 'Mock worker ready'
      }
    })
  );

  render(<ApplicationShell workerClient={createMockWorkerClient({ computeConvolvedImage })} />);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  computeConvolvedImage.mockClear();

  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
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
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

  await user.click(screen.getByRole('button', { name: 'Settings' }));
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
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

  await user.click(screen.getByRole('button', { name: 'Settings' }));
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
      mtfImageUrl: 'data:image/png;base64,bXRm',
      diagnostics: {
        status: 'ready',
        message: 'Mock worker ready'
      }
    })
  );

  render(<ApplicationShell workerClient={createMockWorkerClient({ computeConvolvedImage })} />);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  computeConvolvedImage.mockClear();

  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
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

it('renders the Traditional Chinese aperture mask summary without hardcoded English terms', async () => {
  const user = userEvent.setup();
  renderAtPath('/zh-Hant/advanced');

  await user.click(await screen.findByRole('button', { name: '設定光圈遮罩' }));

  fireEvent.change(screen.getByLabelText('光圈形狀'), {
    target: { value: 'square' }
  });
  const modal = within(screen.getByRole('dialog'));
  fireEvent.change(modal.getByRole('textbox', { name: '中央遮蔽比例' }), {
    target: { value: '0.25' }
  });
  fireEvent.blur(modal.getByRole('textbox', { name: '中央遮蔽比例' }));
  fireEvent.change(screen.getByLabelText('遮蔽物截面形狀'), {
    target: { value: 'regular_hexagon' }
  });
  fireEvent.change(modal.getByRole('textbox', { name: '支架數量' }), {
    target: { value: '4' }
  });
  fireEvent.blur(modal.getByRole('textbox', { name: '支架數量' }));
  fireEvent.change(
    modal.getByRole('textbox', { name: '支架寬度 (單位為口徑倍數)' }),
    {
      target: { value: '0.03' }
    }
  );
  fireEvent.blur(modal.getByRole('textbox', { name: '支架寬度 (單位為口徑倍數)' }));
  fireEvent.change(modal.getByRole('textbox', { name: '支架旋轉角度' }), {
    target: { value: '12' }
  });
  fireEvent.blur(modal.getByRole('textbox', { name: '支架旋轉角度' }));
  fireEvent.click(modal.getByRole('switch', { name: /高斯變跡/u }));
  fireEvent.change(
    modal.getByRole('textbox', {
      name: '標準差 (單位為口徑倍數)'
    }),
    {
      target: { value: '0.5' }
    }
  );
  fireEvent.blur(
    modal.getByRole('textbox', {
      name: '標準差 (單位為口徑倍數)'
    })
  );
  fireEvent.click(screen.getByRole('button', { name: '確認光圈遮罩設定' }));

  const summary = screen.getByText(/25%/u);
  expect(summary).toHaveTextContent('正方形');
  expect(summary).toHaveTextContent('正六邊形');
  expect(summary).not.toHaveTextContent(
    /obstruction|spider|rotated|Gaussian apodization|sigma/iu
  );
});

it('uses Mainland Simplified Chinese terminology for aperture and optics text', async () => {
  const user = userEvent.setup();
  renderAtPath('/zh-Hans/advanced');

  expect(await screen.findByRole('heading', { name: '光学像差 (泽尼克)' })).toBeInTheDocument();

  expect(screen.getByText('点扩散函数')).toBeInTheDocument();
  expect(screen.getByText('波前误差图')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: '编辑孔径遮挡' }));

  expect(screen.getByRole('textbox', { name: '中央遮挡比例' })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: '支架数量' })).toBeInTheDocument();
  expect(screen.getByRole('switch', { name: /高斯切趾/u })).toBeInTheDocument();

  expect(document.body).not.toHaveTextContent(/點擴散函數|波前誤差圖|Zernike|光圈|中央遮蔽|高斯變跡/u);
});

it('describes the default simulated image target in plain language', async () => {
  vi.useFakeTimers();
  await act(async () => {
    render(<ApplicationShell workerClient={createMockWorkerClient()} />);
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
    render(<ApplicationShell workerClient={createMockWorkerClient()} />);
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
      'This shows how the selected picture would look through the current optical settings. Current target: A circular pattern of black-and-white spokes, useful for showing defocus and astigmatism.'
    )
  ).toBeInTheDocument();
  expect(screen.queryByText(psfCutoffNote)).not.toBeInTheDocument();
});

it('shows zernike textbox values and resets changed values', async () => {
  const user = userEvent.setup();
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

  expect(screen.getByRole('heading', { name: 'Optical Aberrations (Zernike)' })).toHaveClass(
    'MuiTypography-h6'
  );
  expect(
    screen.getByRole('textbox', { name: 'Pentafoil (Vertical) Z(5,-5) coefficient' })
  ).toHaveValue('0.000');
  expect(
    screen.getByRole('textbox', {
      name: 'Secondary Spherical Aberration Z(6,0) coefficient'
    })
  ).toHaveValue('0.000');
  const sphericalCoefficient = screen.getByRole('textbox', {
    name: 'Primary Spherical Aberration Z(4,0) coefficient'
  });
  expect(sphericalCoefficient).toHaveValue('0.000');
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
  expect(sphericalCoefficient).toHaveValue('0.000');
  await act(async () => {
    fireEvent.keyUp(spherical, { key: 'ArrowRight' });
  });
  expect(sphericalCoefficient).toHaveValue('0.002');

  await user.click(screen.getByRole('button', { name: 'Reset aberrations' }));
  expect(sphericalCoefficient).toHaveValue('0.000');

  await user.clear(sphericalCoefficient);
  await user.type(sphericalCoefficient, '1.2345');
  expect(sphericalCoefficient).toHaveValue('1.2345');
  fireEvent.blur(sphericalCoefficient);
  expect(sphericalCoefficient).toHaveValue('1.235');

  await user.click(screen.getByRole('button', { name: 'Reset aberrations' }));
  expect(sphericalCoefficient).toHaveValue('0.000');
});

it('groups lower and higher order zernike controls in expanded accordions', () => {
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

  const lowerOrderSummary = screen.getByRole('button', {
    name: 'Lower Order Aberrations (Generally Correctable with Ordinary Eyeglasses)'
  });
  const thirdOrderSummary = screen.getByRole('button', { name: '3rd Order' });
  const fourthOrderSummary = screen.getByRole('button', { name: '4th Order' });
  const fifthOrderSummary = screen.getByRole('button', { name: '5th Order' });
  const sixthOrderSummary = screen.getByRole('button', { name: '6th Order' });

  expect(
    screen.getByRole('heading', { name: 'Higher Order Aberrations' })
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Higher Order Aberrations' })
  ).not.toBeInTheDocument();
  expect(lowerOrderSummary).toHaveAttribute('aria-expanded', 'true');
  expect(thirdOrderSummary).toHaveAttribute('aria-expanded', 'true');
  expect(fourthOrderSummary).toHaveAttribute('aria-expanded', 'true');
  expect(fifthOrderSummary).toHaveAttribute('aria-expanded', 'true');
  expect(sixthOrderSummary).toHaveAttribute('aria-expanded', 'true');

  const lowerOrderDetails = lowerOrderSummary
    .closest('.MuiAccordion-root')
    ?.querySelector('.MuiAccordionDetails-root');
  const thirdOrderDetails = thirdOrderSummary
    .closest('.MuiAccordion-root')
    ?.querySelector('.MuiAccordionDetails-root');
  const fourthOrderDetails = fourthOrderSummary
    .closest('.MuiAccordion-root')
    ?.querySelector('.MuiAccordionDetails-root');
  const fifthOrderDetails = fifthOrderSummary
    .closest('.MuiAccordion-root')
    ?.querySelector('.MuiAccordionDetails-root');
  const sixthOrderDetails = sixthOrderSummary
    .closest('.MuiAccordion-root')
    ?.querySelector('.MuiAccordionDetails-root');
  expect(lowerOrderDetails).toBeInstanceOf(HTMLElement);
  expect(thirdOrderDetails).toBeInstanceOf(HTMLElement);
  expect(fourthOrderDetails).toBeInstanceOf(HTMLElement);
  expect(fifthOrderDetails).toBeInstanceOf(HTMLElement);
  expect(sixthOrderDetails).toBeInstanceOf(HTMLElement);

  expect(
    within(lowerOrderDetails as HTMLElement).getByRole('slider', {
      name: 'Astigmatism (Oblique) Z(2,-2) coefficient'
    })
  ).toBeInTheDocument();
  expect(
    within(lowerOrderDetails as HTMLElement).getByRole('slider', {
      name: 'Defocus Z(2,0) coefficient'
    })
  ).toBeInTheDocument();
  expect(
    within(lowerOrderDetails as HTMLElement).getByRole('slider', {
      name: 'Astigmatism (Vertical) Z(2,2) coefficient'
    })
  ).toBeInTheDocument();
  expect(
    within(thirdOrderDetails as HTMLElement).getByRole('slider', {
      name: 'Trefoil (Vertical) Z(3,-3) coefficient'
    })
  ).toBeInTheDocument();
  expect(
    within(fourthOrderDetails as HTMLElement).getByRole('slider', {
      name: 'Primary Spherical Aberration Z(4,0) coefficient'
    })
  ).toBeInTheDocument();
  expect(
    within(fourthOrderDetails as HTMLElement).getByRole('textbox', {
      name: 'Primary Spherical Aberration Z(4,0) coefficient'
    })
  ).toBeInTheDocument();
  expect(
    within(fourthOrderDetails as HTMLElement).getByText('Pri. Spherical Aberration')
  ).toBeInTheDocument();
  expect(
    within(fourthOrderDetails as HTMLElement).queryByText('Primary Spherical Aberration')
  ).not.toBeInTheDocument();
  expect(within(fourthOrderDetails as HTMLElement).getByText('Z(4,0)')).toBeInTheDocument();
  expect(
    within(fifthOrderDetails as HTMLElement).getByRole('slider', {
      name: 'Secondary Coma (Vertical) Z(5,-1) coefficient'
    })
  ).toBeInTheDocument();
  expect(
    within(sixthOrderDetails as HTMLElement).getByRole('slider', {
      name: 'Secondary Spherical Aberration Z(6,0) coefficient'
    })
  ).toBeInTheDocument();
  expect(within(sixthOrderDetails as HTMLElement).getAllByText('Sec. Quadrafoil')).toHaveLength(2);
  expect(within(sixthOrderDetails as HTMLElement).getAllByText('Oblique').length).toBeGreaterThan(0);
  expect(within(sixthOrderDetails as HTMLElement).getAllByText('Ter. Astigmatism')).toHaveLength(2);
  expect(within(sixthOrderDetails as HTMLElement).getAllByText('Vertical').length).toBeGreaterThan(0);
  expect(within(sixthOrderDetails as HTMLElement).getByText('Z(6,-4)')).toBeInTheDocument();
  expect(
    within(sixthOrderDetails as HTMLElement).queryByText('Secondary Quadrafoil (Oblique)')
  ).not.toBeInTheDocument();
  expect(
    within(lowerOrderDetails as HTMLElement).queryByRole('slider', {
      name: 'Primary Spherical Aberration Z(4,0) coefficient'
    })
  ).not.toBeInTheDocument();
});

it('keeps non-English zernike labels visible as localized chips', async () => {
  window.localStorage.setItem(cachedLanguageKey, 'zh-Hant');
  renderAtPath('/zh-Hant/basic');

  const sixthOrderSummary = screen.getByRole('button', { name: '第6階' });
  const sixthOrderDetails = sixthOrderSummary
    .closest('.MuiAccordion-root')
    ?.querySelector('.MuiAccordionDetails-root');
  expect(sixthOrderDetails).toBeInstanceOf(HTMLElement);

  expect(
    within(sixthOrderDetails as HTMLElement).getByRole('slider', {
      name: '二級四葉差 (斜向) Z(6,-4) 係數'
    })
  ).toBeInTheDocument();
  expect(within(sixthOrderDetails as HTMLElement).getAllByText('二級四葉差')).toHaveLength(2);
  expect(within(sixthOrderDetails as HTMLElement).getAllByText('斜向').length).toBeGreaterThan(0);
  expect(
    within(sixthOrderDetails as HTMLElement).queryByText('二級四葉差 (斜向)')
  ).not.toBeInTheDocument();
  expect(within(sixthOrderDetails as HTMLElement).getByText('Z(6,-4)')).toBeInTheDocument();
});

it('shows the zernike coefficient unit selector defaulting to wave', async () => {
  vi.useFakeTimers();
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });

  expect(screen.getByText('Coefficient Unit (RMS)')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Wave' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Micron' })).toHaveAttribute('aria-pressed', 'false');
});

it('shows the spectral selector only in Advanced Mode defaulting to monochromatic', async () => {
  const user = userEvent.setup();
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

  expect(screen.queryByText('Spectral Mode')).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Settings' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

  expect(screen.getByText('Spectral Mode')).toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Spectral Mode' })).toBeInTheDocument();
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
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

  expect(screen.queryByRole('tab', { name: '550 nm' })).not.toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: '656 nm' })).not.toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: '486 nm' })).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Settings' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

  expect(screen.queryByRole('tab', { name: '550 nm' })).not.toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: '656 nm' })).not.toBeInTheDocument();
  expect(screen.queryByRole('tab', { name: '486 nm' })).not.toBeInTheDocument();
});

it('shows wavelength tabs and sync controls in Advanced Polychromatic mode', async () => {
  const user = userEvent.setup();
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

  expect(screen.queryByRole('switch', { name: 'Sync wavelengths' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Reset all wavelengths' })).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Settings' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await user.click(screen.getByRole('button', { name: 'Polychromatic' }));

  expect(screen.getByRole('tab', { name: '550 nm' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tab', { name: '656 nm' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: '486 nm' })).toBeInTheDocument();
  expect(screen.getByRole('switch', { name: 'Sync wavelengths' })).toBeChecked();
  expect(screen.getByRole('button', { name: 'Reset all wavelengths' })).toBeInTheDocument();
});

it('syncs changed polychromatic coefficient values across wavelength tabs by default', async () => {
  const user = userEvent.setup();
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

  await user.click(screen.getByRole('button', { name: 'Settings' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await user.click(screen.getByRole('button', { name: 'Polychromatic' }));

  const sphericalName = 'Primary Spherical Aberration Z(4,0) coefficient';
  await user.clear(screen.getByRole('textbox', { name: sphericalName }));
  await user.type(screen.getByRole('textbox', { name: sphericalName }), '1.000');
  fireEvent.blur(screen.getByRole('textbox', { name: sphericalName }));

  await user.click(screen.getByRole('tab', { name: '656 nm' }));
  expect(screen.getByRole('textbox', { name: sphericalName })).toHaveValue('1.000');
  await user.clear(screen.getByRole('textbox', { name: sphericalName }));
  await user.type(screen.getByRole('textbox', { name: sphericalName }), '2.000');
  fireEvent.blur(screen.getByRole('textbox', { name: sphericalName }));

  await user.click(screen.getByRole('tab', { name: '486 nm' }));
  expect(screen.getByRole('textbox', { name: sphericalName })).toHaveValue('2.000');

  await user.click(screen.getByRole('tab', { name: '550 nm' }));
  expect(screen.getByRole('textbox', { name: sphericalName })).toHaveValue('2.000');
});

it('leaves untouched polychromatic coefficients unchanged when syncing one coefficient', async () => {
  const user = userEvent.setup();
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

  await user.click(screen.getByRole('button', { name: 'Settings' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await user.click(screen.getByRole('button', { name: 'Polychromatic' }));

  const defocusName = 'Defocus Z(2,0) coefficient';
  const sphericalName = 'Primary Spherical Aberration Z(4,0) coefficient';
  await user.click(screen.getByRole('switch', { name: 'Sync wavelengths' }));
  await user.click(screen.getByRole('tab', { name: '656 nm' }));
  await user.clear(screen.getByRole('textbox', { name: defocusName }));
  await user.type(screen.getByRole('textbox', { name: defocusName }), '1.500');
  fireEvent.blur(screen.getByRole('textbox', { name: defocusName }));
  await user.click(screen.getByRole('switch', { name: 'Sync wavelengths' }));

  await user.click(screen.getByRole('tab', { name: '550 nm' }));
  await user.clear(screen.getByRole('textbox', { name: sphericalName }));
  await user.type(screen.getByRole('textbox', { name: sphericalName }), '2.000');
  fireEvent.blur(screen.getByRole('textbox', { name: sphericalName }));

  await user.click(screen.getByRole('tab', { name: '656 nm' }));
  expect(screen.getByRole('textbox', { name: sphericalName })).toHaveValue('2.000');
  expect(screen.getByRole('textbox', { name: defocusName })).toHaveValue('1.500');

  await user.click(screen.getByRole('tab', { name: '486 nm' }));
  expect(screen.getByRole('textbox', { name: sphericalName })).toHaveValue('2.000');
  expect(screen.getByRole('textbox', { name: defocusName })).toHaveValue('0.000');
});

it('keeps polychromatic wavelength aberration values independent when sync is off', async () => {
  const user = userEvent.setup();
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

  await user.click(screen.getByRole('button', { name: 'Settings' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await user.click(screen.getByRole('button', { name: 'Polychromatic' }));
  await user.click(screen.getByRole('switch', { name: 'Sync wavelengths' }));

  const sphericalName = 'Primary Spherical Aberration Z(4,0) coefficient';
  await user.clear(screen.getByRole('textbox', { name: sphericalName }));
  await user.type(screen.getByRole('textbox', { name: sphericalName }), '1.000');
  fireEvent.blur(screen.getByRole('textbox', { name: sphericalName }));

  await user.click(screen.getByRole('tab', { name: '656 nm' }));
  expect(screen.getByRole('textbox', { name: sphericalName })).toHaveValue('0.000');
  await user.clear(screen.getByRole('textbox', { name: sphericalName }));
  await user.type(screen.getByRole('textbox', { name: sphericalName }), '2.000');
  fireEvent.blur(screen.getByRole('textbox', { name: sphericalName }));

  await user.click(screen.getByRole('tab', { name: '486 nm' }));
  expect(screen.getByRole('textbox', { name: sphericalName })).toHaveValue('0.000');

  await user.click(screen.getByRole('tab', { name: '550 nm' }));
  expect(screen.getByRole('textbox', { name: sphericalName })).toHaveValue('1.000');
  await user.click(screen.getByRole('tab', { name: '656 nm' }));
  expect(screen.getByRole('textbox', { name: sphericalName })).toHaveValue('2.000');
});

it('resets only the selected polychromatic wavelength when sync is on', async () => {
  const user = userEvent.setup();
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

  await user.click(screen.getByRole('button', { name: 'Settings' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await user.click(screen.getByRole('button', { name: 'Polychromatic' }));

  const sphericalName = 'Primary Spherical Aberration Z(4,0) coefficient';
  await user.clear(screen.getByRole('textbox', { name: sphericalName }));
  await user.type(screen.getByRole('textbox', { name: sphericalName }), '1.250');
  fireEvent.blur(screen.getByRole('textbox', { name: sphericalName }));

  await user.click(screen.getByRole('tab', { name: '656 nm' }));
  await user.click(screen.getByRole('button', { name: 'Reset aberrations' }));
  expect(screen.getByRole('textbox', { name: sphericalName })).toHaveValue('0.000');

  await user.click(screen.getByRole('tab', { name: '550 nm' }));
  expect(screen.getByRole('textbox', { name: sphericalName })).toHaveValue('1.250');
  await user.click(screen.getByRole('tab', { name: '486 nm' }));
  expect(screen.getByRole('textbox', { name: sphericalName })).toHaveValue('1.250');
});

it('resets all polychromatic wavelength coefficient values', async () => {
  const user = userEvent.setup();
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

  await user.click(screen.getByRole('button', { name: 'Settings' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await user.click(screen.getByRole('button', { name: 'Polychromatic' }));

  const sphericalName = 'Primary Spherical Aberration Z(4,0) coefficient';
  await user.clear(screen.getByRole('textbox', { name: sphericalName }));
  await user.type(screen.getByRole('textbox', { name: sphericalName }), '1.250');
  fireEvent.blur(screen.getByRole('textbox', { name: sphericalName }));

  await user.click(screen.getByRole('button', { name: 'Reset all wavelengths' }));

  expect(screen.getByRole('textbox', { name: sphericalName })).toHaveValue('0.000');
  await user.click(screen.getByRole('tab', { name: '656 nm' }));
  expect(screen.getByRole('textbox', { name: sphericalName })).toHaveValue('0.000');
  await user.click(screen.getByRole('tab', { name: '486 nm' }));
  expect(screen.getByRole('textbox', { name: sphericalName })).toHaveValue('0.000');
});

it('shares monochromatic aberration edits with the 550 nm polychromatic tab', async () => {
  const user = userEvent.setup();
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

  const sphericalName = 'Primary Spherical Aberration Z(4,0) coefficient';
  await user.clear(screen.getByRole('textbox', { name: sphericalName }));
  await user.type(screen.getByRole('textbox', { name: sphericalName }), '1.250');
  fireEvent.blur(screen.getByRole('textbox', { name: sphericalName }));

  await user.click(screen.getByRole('button', { name: 'Settings' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await user.click(screen.getByRole('button', { name: 'Polychromatic' }));

  expect(screen.getByRole('textbox', { name: sphericalName })).toHaveValue('1.250');
  await user.clear(screen.getByRole('textbox', { name: sphericalName }));
  await user.type(screen.getByRole('textbox', { name: sphericalName }), '2.000');
  fireEvent.blur(screen.getByRole('textbox', { name: sphericalName }));

  await user.click(screen.getByRole('button', { name: 'Monochromatic' }));

  expect(screen.queryByRole('tab', { name: '550 nm' })).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: sphericalName })).toHaveValue('2.000');
});

it('sends polychromatic worker payloads with wavelength weights and coefficient maps', async () => {
  vi.useFakeTimers();
  const computeConvolvedImage = vi.fn(
    async (input: ConvolvedImageInput): Promise<ConvolvedImageResult> => ({
      imageUrl: `data:image/png;base64,${window.btoa(input.targetId)}`,
      psfImageUrl: `data:image/png;base64,${window.btoa(`${input.targetId}-psf`)}`,
      wavefrontImageUrl: `data:image/png;base64,${window.btoa(`${input.targetId}-wavefront`)}`,
      mtfImageUrl: 'data:image/png;base64,bXRm',
      diagnostics: {
        status: 'ready',
        message: 'Mock worker ready'
      }
    })
  );

  render(<ApplicationShell workerClient={createMockWorkerClient({ computeConvolvedImage })} />);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  computeConvolvedImage.mockClear();

  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  fireEvent.click(screen.getByRole('button', { name: 'Polychromatic' }));

  const sphericalName = 'Primary Spherical Aberration Z(4,0) coefficient';
  fireEvent.change(screen.getByRole('textbox', { name: sphericalName }), {
    target: { value: '1.00' }
  });
  fireEvent.blur(screen.getByRole('textbox', { name: sphericalName }));

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });

  expect(computeConvolvedImage).toHaveBeenLastCalledWith({
    apertureSettings: defaultApertureSettings,
    apertureDiameterMm: 6,
    diagnosticWavelengthNm: 550,
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
      [656, expect.objectContaining({ '4,0': 1 })],
      [486, expect.objectContaining({ '4,0': 1 })]
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
      mtfImageUrl: 'data:image/png;base64,bXRm',
      diagnostics: {
        status: 'ready',
        message: 'Mock worker ready'
      }
    })
  );

  render(<ApplicationShell workerClient={createMockWorkerClient({ computeConvolvedImage })} />);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  computeConvolvedImage.mockClear();

  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
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
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

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

  expect(sphericalCoefficient).toHaveValue('0.550');
});

it('converts polychromatic zernike textbox values using the selected wavelength tab', async () => {
  const user = userEvent.setup();
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

  await user.click(screen.getByRole('button', { name: 'Settings' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await user.click(screen.getByRole('button', { name: 'Polychromatic' }));
  await user.click(screen.getByRole('switch', { name: 'Sync wavelengths' }));

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

  expect(screen.getByRole('textbox', { name: sphericalName })).toHaveValue('0.656');

  await user.click(screen.getByRole('tab', { name: '486 nm' }));

  expect(screen.getByRole('textbox', { name: sphericalName })).toHaveValue('0.486');
});

it('commits micron zernike textbox values to the worker payload in waves', async () => {
  vi.useFakeTimers();
  const computeConvolvedImage = vi.fn(
    async (input: ConvolvedImageInput): Promise<ConvolvedImageResult> => ({
      imageUrl: `data:image/png;base64,${window.btoa(input.targetId)}`,
      psfImageUrl: `data:image/png;base64,${window.btoa(`${input.targetId}-psf`)}`,
      wavefrontImageUrl: `data:image/png;base64,${window.btoa(`${input.targetId}-wavefront`)}`,
      mtfImageUrl: 'data:image/png;base64,bXRm',
      diagnostics: {
        status: 'ready',
        message: 'Mock worker ready'
      }
    })
  );

  render(<ApplicationShell workerClient={createMockWorkerClient({ computeConvolvedImage })} />);

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
      target: { value: '1.100' }
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

it('commits micron zernike spinner steps in displayed microns', async () => {
  vi.useFakeTimers();
  const computeConvolvedImage = vi.fn(
    async (input: ConvolvedImageInput): Promise<ConvolvedImageResult> => ({
      imageUrl: `data:image/png;base64,${window.btoa(input.targetId)}`,
      psfImageUrl: `data:image/png;base64,${window.btoa(`${input.targetId}-psf`)}`,
      wavefrontImageUrl: `data:image/png;base64,${window.btoa(`${input.targetId}-wavefront`)}`,
      mtfImageUrl: 'data:image/png;base64,bXRm',
      diagnostics: {
        status: 'ready',
        message: 'Mock worker ready'
      }
    })
  );

  render(<ApplicationShell workerClient={createMockWorkerClient({ computeConvolvedImage })} />);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  computeConvolvedImage.mockClear();

  fireEvent.click(screen.getByRole('button', { name: 'Micron' }));
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Increase Primary Spherical Aberration Z(4,0) coefficient'
    })
  );

  expect(
    screen.getByRole('textbox', {
      name: 'Primary Spherical Aberration Z(4,0) coefficient'
    })
  ).toHaveValue('0.001');

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
    zernikeCoefficientsByWavelength: [[550, expect.objectContaining({ '4,0': 0.002 })]]
  });
});

it('resets zernike textbox values to zero in the selected coefficient unit', async () => {
  const user = userEvent.setup();
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

  const sphericalCoefficient = screen.getByRole('textbox', {
    name: 'Primary Spherical Aberration Z(4,0) coefficient'
  });
  await user.click(screen.getByRole('button', { name: 'Micron' }));
  await user.clear(sphericalCoefficient);
  await user.type(sphericalCoefficient, '1.100');

  await user.click(screen.getByRole('button', { name: 'Reset aberrations' }));

  expect(sphericalCoefficient).toHaveValue('0.000');
  expect(screen.getByRole('button', { name: 'Micron' })).toHaveAttribute('aria-pressed', 'true');
});

it('commits valid zernike textbox values on blur to the worker payload', async () => {
  vi.useFakeTimers();
  const computeConvolvedImage = vi.fn(
    async (input: ConvolvedImageInput): Promise<ConvolvedImageResult> => ({
      imageUrl: `data:image/png;base64,${window.btoa(input.targetId)}`,
      psfImageUrl: `data:image/png;base64,${window.btoa(`${input.targetId}-psf`)}`,
      wavefrontImageUrl: `data:image/png;base64,${window.btoa(`${input.targetId}-wavefront`)}`,
      mtfImageUrl: 'data:image/png;base64,bXRm',
      diagnostics: {
        status: 'ready',
        message: 'Mock worker ready'
      }
    })
  );

  render(<ApplicationShell workerClient={createMockWorkerClient({ computeConvolvedImage })} />);

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
      mtfImageUrl: 'data:image/png;base64,bXRm',
      diagnostics: {
        status: 'ready',
        message: 'Mock worker ready'
      }
    })
  );

  render(<ApplicationShell workerClient={createMockWorkerClient({ computeConvolvedImage })} />);

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
      mtfImageUrl: 'data:image/png;base64,bXRm',
      diagnostics: {
        status: 'ready',
        message: 'Mock worker ready'
      }
    })
  );

  render(<ApplicationShell workerClient={createMockWorkerClient({ computeConvolvedImage })} />);

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
      mtfImageUrl: 'data:image/png;base64,bXRm',
      diagnostics: {
        status: 'ready',
        message: 'Mock worker ready'
      }
    })
  );

  render(<ApplicationShell workerClient={createMockWorkerClient({ computeConvolvedImage })} />);

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
      mtfImageUrl: 'data:image/png;base64,bXRm',
      diagnostics: {
        status: 'ready',
        message: 'Mock worker ready'
      }
    })
  );

  render(<ApplicationShell workerClient={createMockWorkerClient({ computeConvolvedImage })} />);

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
      mtfImageUrl: 'data:image/png;base64,bXRm',
      diagnostics: {
        status: 'ready',
        message: 'Mock worker ready'
      }
    })
  );

  render(<ApplicationShell workerClient={createMockWorkerClient({ computeConvolvedImage })} />);

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
      mtfImageUrl: 'data:image/png;base64,bXRm',
      diagnostics: {
        status: 'ready',
        message: 'Mock worker ready'
      }
    })
  );

  render(<ApplicationShell workerClient={createMockWorkerClient({ computeConvolvedImage })} />);

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
  expect(sphericalCoefficient).toHaveValue('0.000');

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  expect(computeConvolvedImage).not.toHaveBeenCalled();

  fireEvent.keyUp(sphericalSlider, { key: 'ArrowRight' });
  expect(sphericalCoefficient).toHaveValue('0.001');
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
    zernikeCoefficientsByWavelength: [[550, expect.objectContaining({ '4,0': 0.001 })]]
  });
});

it('keeps pointer slider movement out of the textbox until release, then commits once', async () => {
  vi.useFakeTimers();
  const computeConvolvedImage = vi.fn(
    async (input: ConvolvedImageInput): Promise<ConvolvedImageResult> => ({
      imageUrl: `data:image/png;base64,${window.btoa(input.targetId)}`,
      psfImageUrl: `data:image/png;base64,${window.btoa(`${input.targetId}-psf`)}`,
      wavefrontImageUrl: `data:image/png;base64,${window.btoa(`${input.targetId}-wavefront`)}`,
      mtfImageUrl: 'data:image/png;base64,bXRm',
      diagnostics: {
        status: 'ready',
        message: 'Mock worker ready'
      }
    })
  );

  render(<ApplicationShell workerClient={createMockWorkerClient({ computeConvolvedImage })} />);

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

  const sphericalSliderThumb = sphericalSlider.closest('.MuiSlider-thumb') as HTMLElement;

  fireEvent.touchStart(sphericalSliderThumb, {
    changedTouches: [{ clientX: 125, clientY: 10, identifier: 1 }]
  });
  expect(sphericalCoefficient).toHaveValue('0.000');

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  expect(computeConvolvedImage).not.toHaveBeenCalled();

  fireEvent.touchEnd(document, {
    changedTouches: [{ clientX: 125, clientY: 10, identifier: 1 }]
  });
  expect(sphericalCoefficient).toHaveValue('1.250');
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

it('ignores touch slider movement that starts away from the thumb', async () => {
  vi.useFakeTimers();
  const computeConvolvedImage = vi.fn(
    async (input: ConvolvedImageInput): Promise<ConvolvedImageResult> => ({
      imageUrl: `data:image/png;base64,${window.btoa(input.targetId)}`,
      psfImageUrl: `data:image/png;base64,${window.btoa(`${input.targetId}-psf`)}`,
      wavefrontImageUrl: `data:image/png;base64,${window.btoa(`${input.targetId}-wavefront`)}`,
      mtfImageUrl: 'data:image/png;base64,bXRm',
      diagnostics: {
        status: 'ready',
        message: 'Mock worker ready'
      }
    })
  );

  render(<ApplicationShell workerClient={createMockWorkerClient({ computeConvolvedImage })} />);

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

  const offThumbTouchStart = new Event('touchstart', { bubbles: true, cancelable: true });
  Object.defineProperty(offThumbTouchStart, 'changedTouches', {
    value: [{ clientX: 125, clientY: 10, identifier: 1 }]
  });
  const preventDefault = vi.spyOn(offThumbTouchStart, 'preventDefault');

  fireEvent(sphericalSliderRoot, offThumbTouchStart);
  fireEvent.touchEnd(document, {
    changedTouches: [{ clientX: 125, clientY: 10, identifier: 1 }]
  });

  expect(preventDefault).not.toHaveBeenCalled();
  expect(sphericalCoefficient).toHaveValue('0.000');
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });

  expect(computeConvolvedImage).not.toHaveBeenCalled();
});

it('lets off-thumb touch pointer starts scroll without changing the slider', async () => {
  vi.useFakeTimers();
  const computeConvolvedImage = vi.fn(
    async (input: ConvolvedImageInput): Promise<ConvolvedImageResult> => ({
      imageUrl: `data:image/png;base64,${window.btoa(input.targetId)}`,
      psfImageUrl: `data:image/png;base64,${window.btoa(`${input.targetId}-psf`)}`,
      wavefrontImageUrl: `data:image/png;base64,${window.btoa(`${input.targetId}-wavefront`)}`,
      mtfImageUrl: 'data:image/png;base64,bXRm',
      diagnostics: {
        status: 'ready',
        message: 'Mock worker ready'
      }
    })
  );

  render(<ApplicationShell workerClient={createMockWorkerClient({ computeConvolvedImage })} />);

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

  const offThumbPointerStart = new Event('pointerdown', { bubbles: true, cancelable: true });
  Object.defineProperties(offThumbPointerStart, {
    clientX: { value: 125 },
    clientY: { value: 10 },
    pointerId: { value: 1 },
    pointerType: { value: 'touch' }
  });
  const preventDefault = vi.spyOn(offThumbPointerStart, 'preventDefault');

  fireEvent(sphericalSliderRoot, offThumbPointerStart);
  fireEvent.pointerUp(document, {
    clientX: 125,
    clientY: 10,
    pointerId: 1,
    pointerType: 'touch'
  });

  expect(preventDefault).not.toHaveBeenCalled();
  expect(sphericalCoefficient).toHaveValue('0.000');
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
      mtfImageUrl: 'data:image/png;base64,bXRm',
      diagnostics: {
        status: 'ready',
        message: 'Mock worker ready',
        pyodideVersion: '0.29.3'
      }
    })
  );

  render(<ApplicationShell workerClient={createMockWorkerClient({ computeConvolvedImage })} />);

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
        '2,0': 0.001,
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
      mtfImageUrl: 'data:image/png;base64,bXRm',
      diagnostics: {
        status: 'ready',
        message: 'Mock worker ready'
      }
    })
  );

  render(<ApplicationShell workerClient={createMockWorkerClient({ computeConvolvedImage })} />);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  computeConvolvedImage.mockClear();

  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
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
      mtfImageUrl: 'data:image/png;base64,bXRm',
      diagnostics: {
        status: 'ready',
        message: 'Mock worker ready'
      }
    })
  );

  render(<ApplicationShell workerClient={createMockWorkerClient({ computeConvolvedImage })} />);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  computeConvolvedImage.mockClear();

  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
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
      mtfImageUrl: 'data:image/png;base64,bXRm',
      diagnostics: {
        status: 'ready',
        message: 'Mock worker ready'
      }
    } satisfies ConvolvedImageResult);

  const { rerender } = render(
    <ApplicationShell workerClient={createMockWorkerClient({ computeConvolvedImage })} />
  );

  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.getByText('Preparing image...')).toBeInTheDocument();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
  expect(screen.getByText('Simulation exploded')).toBeInTheDocument();

  rerender(<ApplicationShell workerClient={createMockWorkerClient()} />);
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
      mtfImageUrl: 'data:image/png;base64,bXRm',
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

  render(<ApplicationShell workerClient={createMockWorkerClient({ computeConvolvedImage })} />);

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
      mtfImageUrl: 'data:image/png;base64,bXRm',
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
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

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
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

  await screen.findByRole('button', { name: 'Open enlarged Simulated Image image' });

  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
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

  render(<ApplicationShell workerClient={createMockWorkerClient({ computeConvolvedImage })} />);

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

it('shows PSF and wavefront panels in one image descriptions accordion on large screens', async () => {
  const user = userEvent.setup();
  setMatchesSm(true);
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

  expect(screen.getByRole('heading', { name: 'Simulated Image' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'PSF' })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Wavefront Map' })).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Settings' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  await user.keyboard('{Escape}');

  const imageDescriptionsButton = screen.getByRole('button', {
    name: 'Image Descriptions'
  });
  expect(within(imageDescriptionsButton).getByText('Image Descriptions')).toHaveClass(
    'MuiTypography-h6'
  );
  expect(imageDescriptionsButton).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getAllByRole('button', { name: 'Image Descriptions' })).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'PSF' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Wavefront Map' })).not.toBeInTheDocument();
  expect(within(imageDescriptionsButton).queryByText('Simulated Image')).not.toBeInTheDocument();
  expect(within(imageDescriptionsButton).queryByText('PSF')).not.toBeInTheDocument();
  expect(within(imageDescriptionsButton).queryByText('Wavefront Map')).not.toBeInTheDocument();

  const imageDescriptionsDetails = screen
    .getByText(psfCutoffNote)
    .closest('.MuiAccordionDetails-root');
  expect(imageDescriptionsDetails).not.toBeNull();
  expect(
    within(imageDescriptionsDetails as HTMLElement).getByText('Simulated Image')
  ).toBeInTheDocument();
  expect(within(imageDescriptionsDetails as HTMLElement).getByText('PSF')).toBeInTheDocument();
  expect(
    within(imageDescriptionsDetails as HTMLElement).getByText('Wavefront Map')
  ).toBeInTheDocument();
  expect(within(imageDescriptionsDetails as HTMLElement).getByText('Simulated Image')).toHaveStyle({
    fontSize: '1rem'
  });
  expect(within(imageDescriptionsDetails as HTMLElement).getByText('PSF')).toHaveStyle({
    fontSize: '1rem'
  });
  expect(within(imageDescriptionsDetails as HTMLElement).getByText('Wavefront Map')).toHaveStyle({
    fontSize: '1rem'
  });

  const psfDescription = screen.getByRole('group', { name: 'PSF description' });
  expect(within(psfDescription).getByText(psfCutoffNote)).toBeInTheDocument();
  const simulatedImageDescription = screen.getByRole('group', {
    name: 'Simulated Image description'
  });
  const wavefrontDescription = screen.getByRole('group', {
    name: 'Wavefront Map description'
  });
  const sharedEnlargementHint = within(imageDescriptionsDetails as HTMLElement).getByText(
    enlargementHint
  );
  expect(within(imageDescriptionsDetails as HTMLElement).getAllByText(enlargementHint)).toHaveLength(
    1
  );
  expect(
    simulatedImageDescription.compareDocumentPosition(sharedEnlargementHint) &
      Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  expect(
    psfDescription.compareDocumentPosition(sharedEnlargementHint) &
      Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  expect(
    wavefrontDescription.compareDocumentPosition(sharedEnlargementHint) &
      Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();

  fireEvent.change(screen.getByLabelText('Target'), {
    target: { value: 'siemensstar' }
  });

  expect(within(psfDescription).queryByText(psfCutoffNote)).not.toBeInTheDocument();
});

it('shows the approximate Strehl ratio above the small-screen advanced simulated image accordion', async () => {
  const user = userEvent.setup();
  setMatchesSm(false);
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

  expect(screen.queryByText(/Approx\. Strehl Ratio/)).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Settings' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  await user.keyboard('{Escape}');

  const simulatedImageCard = screen
    .getByRole('button', { name: 'Simulated Image' })
    .closest('.MuiCard-root');
  expect(simulatedImageCard).not.toBeNull();

  const strehl = within(simulatedImageCard as HTMLElement).getByText(
    'Approx. Strehl Ratio: 100.0%'
  );
  const simulatedImageSummary = within(simulatedImageCard as HTMLElement).getByRole('button', {
    name: 'Simulated Image'
  });

  expect(
    strehl.compareDocumentPosition(simulatedImageSummary) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  expect(within(simulatedImageSummary).queryByText(/Approx\. Strehl Ratio/)).not.toBeInTheDocument();
  expect(strehl).toBeInTheDocument();
  expect(screen.getAllByText(/Approx\. Strehl Ratio/)).toHaveLength(1);
});

it('shows the approximate Strehl ratio once above the large-screen combined image descriptions accordion', async () => {
  const user = userEvent.setup();
  setMatchesSm(true);
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

  await user.click(screen.getByRole('button', { name: 'Settings' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  await user.keyboard('{Escape}');

  const advancedResultCard = screen
    .getByRole('button', {
      name: 'Image Descriptions'
    })
    .closest('.MuiCard-root');
  expect(advancedResultCard).not.toBeNull();

  const strehl = within(advancedResultCard as HTMLElement).getByText(
    'Approx. Strehl Ratio: 100.0%'
  );
  const imageDescriptionsSummary = within(advancedResultCard as HTMLElement).getByRole('button', {
    name: 'Image Descriptions'
  });

  expect(
    strehl.compareDocumentPosition(imageDescriptionsSummary) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  expect(within(imageDescriptionsSummary).queryByText(/Approx\. Strehl Ratio/)).not.toBeInTheDocument();
  expect(strehl).toBeInTheDocument();
  expect(screen.getAllByText(/Approx\. Strehl Ratio/)).toHaveLength(1);
});

it('shows independent approximate Strehl ratios for each polychromatic wavelength', async () => {
  const user = userEvent.setup();
  setMatchesSm(true);
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

  await user.click(screen.getByRole('button', { name: 'Settings' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: 'Polychromatic' }));
  await user.click(screen.getByRole('switch', { name: 'Sync wavelengths' }));

  const sphericalName = 'Primary Spherical Aberration Z(4,0) coefficient';
  await user.clear(screen.getByRole('textbox', { name: sphericalName }));
  await user.type(screen.getByRole('textbox', { name: sphericalName }), '0.10');
  fireEvent.blur(screen.getByRole('textbox', { name: sphericalName }));

  await user.click(screen.getByRole('tab', { name: '656 nm' }));
  await user.clear(screen.getByRole('textbox', { name: sphericalName }));
  await user.type(screen.getByRole('textbox', { name: sphericalName }), '0.20');
  fireEvent.blur(screen.getByRole('textbox', { name: sphericalName }));

  await user.click(screen.getByRole('tab', { name: '486 nm' }));
  await user.clear(screen.getByRole('textbox', { name: sphericalName }));
  await user.type(screen.getByRole('textbox', { name: sphericalName }), '0.30');
  fireEvent.blur(screen.getByRole('textbox', { name: sphericalName }));

  const advancedResultCard = screen
    .getByRole('button', {
      name: 'Image Descriptions'
    })
    .closest('.MuiCard-root');
  expect(advancedResultCard).not.toBeNull();
  const card = within(advancedResultCard as HTMLElement);

  expect(card.getByText('550 nm: 67.4%')).toBeInTheDocument();
  expect(card.getByText('656 nm: 20.6%')).toBeInTheDocument();
  expect(card.getByText('486 nm: 2.9%')).toBeInTheDocument();
  expect(card.getAllByRole('separator')).toHaveLength(2);
});

it('wraps small-screen polychromatic approximate Strehl ratios inside the simulated image card', async () => {
  const user = userEvent.setup();
  setMatchesSm(false);
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

  await user.click(screen.getByRole('button', { name: 'Settings' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: 'Polychromatic' }));

  const simulatedImageCard = screen
    .getByRole('button', { name: 'Simulated Image' })
    .closest('.MuiCard-root');
  expect(simulatedImageCard).not.toBeNull();

  const card = within(simulatedImageCard as HTMLElement);
  const strehlLabel = card.getByText('Approx. Strehl Ratio:');
  const strehlBlock = strehlLabel.parentElement;
  expect(strehlBlock).not.toBeNull();

  expect(card.getAllByText('Approx. Strehl Ratio:')).toHaveLength(1);
  expect(card.getAllByText('550 nm: 100.0%')).toHaveLength(1);
  expect(card.getAllByText('656 nm: 100.0%')).toHaveLength(1);
  expect(card.getAllByText('486 nm: 100.0%')).toHaveLength(1);
  expect(strehlBlock).toHaveStyle({ flexWrap: 'wrap', overflowX: 'visible' });
});

it('does not show the approximate Strehl ratio in basic mode', () => {
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

  expect(screen.queryByText(/Approx\. Strehl Ratio/)).not.toBeInTheDocument();
});

it('shows the legend unit selector at the bottom of the wavefront map card in advanced display mode', async () => {
  const user = userEvent.setup();
  setMatchesSm(true);
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

  expect(screen.queryByText('Legend Unit')).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Settings' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  await user.keyboard('{Escape}');

  expect(screen.getByRole('button', { name: 'Image Descriptions' })).toHaveAttribute(
    'aria-expanded',
    'true'
  );
  const wavefrontCard = within(screen.getByRole('group', { name: 'Wavefront Map description' }));
  expect(
    wavefrontCard.getByText('The rendered wavefront map for the current Zernike aberration values.')
  ).toBeInTheDocument();
  expect(wavefrontCard.getByText('Legend Unit')).toBeInTheDocument();
  expect(wavefrontCard.getByRole('button', { name: 'Wave' })).toHaveClass('MuiButton-contained');
  expect(wavefrontCard.getByRole('button', { name: 'Micron' })).toBeInTheDocument();
});

it.each(['point_source', 'wide_point_source'] as const)(
  'hides the PSF panel and keeps one image descriptions accordion for %s targets',
  async (targetId) => {
    const user = userEvent.setup();
    setMatchesSm(true);
    render(<ApplicationShell workerClient={createMockWorkerClient()} />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Advanced' }));
    await user.keyboard('{Escape}');
    fireEvent.change(screen.getByLabelText('Target'), {
      target: { value: targetId }
    });

    const imageDescriptionsButton = screen.getByRole('button', {
      name: 'Image Descriptions'
    });
    expect(imageDescriptionsButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByRole('button', { name: 'PSF' })).not.toBeInTheDocument();
    expect(within(imageDescriptionsButton).queryByText('Simulated Image')).not.toBeInTheDocument();
    expect(within(imageDescriptionsButton).queryByText('PSF')).not.toBeInTheDocument();
    expect(within(imageDescriptionsButton).queryByText('Wavefront Map')).not.toBeInTheDocument();

    const imageDescriptionsDetails = screen
      .getByRole('group', { name: 'Wavefront Map description' })
      .closest('.MuiAccordionDetails-root');
    expect(imageDescriptionsDetails).not.toBeNull();
    expect(
      within(imageDescriptionsDetails as HTMLElement).getByText('Simulated Image')
    ).toBeInTheDocument();
    expect(
      within(imageDescriptionsDetails as HTMLElement).queryByText('PSF')
    ).not.toBeInTheDocument();
    expect(
      within(imageDescriptionsDetails as HTMLElement).getByText('Wavefront Map')
    ).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'PSF description' })).not.toBeInTheDocument();
  }
);

it('keeps advanced result panels in separate cards on extra-small screens', async () => {
  const user = userEvent.setup();
  setMatchesSm(false);
  render(<ApplicationShell workerClient={createMockWorkerClient()} />);

  await user.click(screen.getByRole('button', { name: 'Settings' }));
  await user.click(screen.getByRole('button', { name: 'Advanced' }));
  await user.keyboard('{Escape}');

  const simulatedImageCard = screen
    .getByRole('button', { name: 'Simulated Image' })
    .closest('.MuiCard-root');
  const psfCard = screen.getByRole('button', { name: 'PSF' }).closest('.MuiCard-root');
  const wavefrontCard = screen
    .getByRole('button', { name: 'Wavefront Map' })
    .closest('.MuiCard-root');

  expect(psfCard).not.toBe(simulatedImageCard);
  expect(wavefrontCard).not.toBe(simulatedImageCard);
  expect(wavefrontCard).not.toBe(psfCard);
  expect(screen.queryByRole('button', { name: 'Image Descriptions' })).not.toBeInTheDocument();
  expect(
    within(screen.getByRole('button', { name: 'Simulated Image' })).getByText('Simulated Image')
  ).toHaveClass('MuiTypography-h6');
  expect(within(screen.getByRole('button', { name: 'PSF' })).getByText('PSF')).toHaveClass(
    'MuiTypography-h6'
  );
  expect(
    within(screen.getByRole('button', { name: 'Wavefront Map' })).getByText('Wavefront Map')
  ).toHaveClass('MuiTypography-h6');
  expect(screen.getByRole('button', { name: 'PSF' })).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('button', { name: 'Wavefront Map' })).toHaveAttribute(
    'aria-expanded',
    'true'
  );
});
