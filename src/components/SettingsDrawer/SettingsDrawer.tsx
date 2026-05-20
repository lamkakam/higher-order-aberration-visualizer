import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Drawer from '@mui/material/Drawer';
import FormControlLabel from '@mui/material/FormControlLabel';
import NativeSelect from '@mui/material/NativeSelect';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { supportedLanguageCodes } from '../../i18n';
import type { SupportedLanguageCode } from '../../i18n';

export type ThemeMode = 'light' | 'system' | 'dark';
export type DisplayMode = 'basic' | 'advanced';

interface SettingsDrawerProps {
  readonly open: boolean;
  readonly selectedLanguage: SupportedLanguageCode;
  readonly mode: ThemeMode;
  readonly displayMode: DisplayMode;
  readonly showScaleBar: boolean;
  readonly onClose: () => void;
  readonly onLanguageChange: (language: SupportedLanguageCode) => void;
  readonly onModeChange: (mode: ThemeMode) => void;
  readonly onDisplayModeChange: (mode: DisplayMode) => void;
  readonly onShowScaleBarChange: (showScaleBar: boolean) => void;
}

const modeOptions = [
  { value: 'light', labelKey: 'settings.light' },
  { value: 'system', labelKey: 'settings.system' },
  { value: 'dark', labelKey: 'settings.dark' }
] as const;

const displayModeOptions = [
  { value: 'basic', labelKey: 'settings.basic' },
  { value: 'advanced', labelKey: 'settings.advanced' }
] as const;

export function SettingsDrawer({
  open,
  selectedLanguage,
  mode,
  displayMode,
  showScaleBar,
  onClose,
  onLanguageChange,
  onModeChange,
  onDisplayModeChange,
  onShowScaleBarChange
}: SettingsDrawerProps) {
  const { t } = useTranslation();
  const languageSelectId = useId();

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box style={{ boxSizing: 'border-box' }} sx={{ maxWidth: '100vw', width: 320, p: 3 }}>
        <Typography
          component="label"
          htmlFor={languageSelectId}
          variant="subtitle2"
          sx={{ display: 'block', mb: 1 }}
        >
          {t('language.label')}
        </Typography>
        <NativeSelect
          fullWidth
          value={selectedLanguage}
          onChange={(event) => {
            const nextLanguage = event.target.value as SupportedLanguageCode;
            onLanguageChange(nextLanguage);
          }}
          inputProps={{
            id: languageSelectId
          }}
        >
          {supportedLanguageCodes.map((languageCode) => (
            <option key={languageCode} value={languageCode}>
              {t(`language.options.${languageCode}`)}
            </option>
          ))}
        </NativeSelect>
        <Typography id="mode-button-group-label" variant="subtitle2" sx={{ mb: 1, mt: 3 }}>
          {t('settings.mode')}
        </Typography>
        <ButtonGroup aria-labelledby="mode-button-group-label" fullWidth>
          {modeOptions.map((option) => (
            <Button
              key={option.value}
              aria-label={t(option.labelKey)}
              variant={mode === option.value ? 'contained' : 'outlined'}
              sx={{ whiteSpace: 'nowrap' }}
              onClick={() => {
                onModeChange(option.value);
              }}
            >
              {t(option.labelKey)}
            </Button>
          ))}
        </ButtonGroup>
        <Typography id="display-mode-button-group-label" variant="subtitle2" sx={{ mb: 1, mt: 3 }}>
          {t('settings.display')}
        </Typography>
        <ButtonGroup aria-labelledby="display-mode-button-group-label" fullWidth>
          {displayModeOptions.map((option) => (
            <Button
              key={option.value}
              aria-label={t(option.labelKey)}
              variant={displayMode === option.value ? 'contained' : 'outlined'}
              onClick={() => {
                onDisplayModeChange(option.value);
              }}
            >
              {t(option.labelKey)}
            </Button>
          ))}
        </ButtonGroup>
        <FormControlLabel
          sx={{ mt: 3 }}
          control={
            <Switch
              checked={showScaleBar}
              onChange={(event) => {
                onShowScaleBarChange(event.target.checked);
              }}
              slotProps={{ input: { 'aria-label': t('settings.showScaleBar') } }}
            />
          }
          label={t('settings.showScaleBar')}
        />
      </Box>
    </Drawer>
  );
}
