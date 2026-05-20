import { supportedLanguageCodes, type SupportedLanguageCode } from './i18n';
import type { DisplayMode } from './components/SettingsDrawer';

const displayModeRouteValues = ['basic', 'advanced'] as const;

export function isSupportedLanguageCode(
  language: string | undefined
): language is SupportedLanguageCode {
  return supportedLanguageCodes.includes(language as SupportedLanguageCode);
}

export function isDisplayMode(displayMode: string | undefined): displayMode is DisplayMode {
  return displayModeRouteValues.includes(displayMode as DisplayMode);
}

export function createAppPath(language: SupportedLanguageCode, displayMode: DisplayMode) {
  return `/${language}/${displayMode}`;
}
