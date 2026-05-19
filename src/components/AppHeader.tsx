import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import NativeSelect from '@mui/material/NativeSelect';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { supportedLanguageCodes } from '../i18n';
import type { SupportedLanguageCode } from '../i18n';

interface AppHeaderProps {
  readonly selectedLanguage: SupportedLanguageCode;
  readonly onLanguageChange: (language: SupportedLanguageCode) => void;
  readonly onOpenSettings: () => void;
}

export function AppHeader({
  selectedLanguage,
  onLanguageChange,
  onOpenSettings
}: AppHeaderProps) {
  const { t } = useTranslation();
  const languageSelectId = useId();

  return (
    <AppBar position="static" color="default" elevation={0}>
      <Toolbar sx={{ gap: 2, justifyContent: 'space-between' }}>
        <Box>
          <Typography component="p" variant="h6">
            {t('app.name')}
          </Typography>
          <Typography component="p" variant="body2" color="text.secondary">
            {t('app.subtitle')}
          </Typography>
        </Box>
        <Box sx={{ alignItems: 'center', display: 'flex', gap: 1.5 }}>
          <FormControl size="small">
            <InputLabel htmlFor={languageSelectId}>{t('language.label')}</InputLabel>
            <NativeSelect
              value={selectedLanguage}
              onChange={(event) => {
                const nextLanguage = event.target.value as SupportedLanguageCode;
                onLanguageChange(nextLanguage);
              }}
              inputProps={{
                id: languageSelectId,
                'aria-label': t('language.label')
              }}
            >
              {supportedLanguageCodes.map((languageCode) => (
                <option key={languageCode} value={languageCode}>
                  {t(`language.options.${languageCode}`)}
                </option>
              ))}
            </NativeSelect>
          </FormControl>
          <Button aria-label={t('settings.open')} variant="contained" onClick={onOpenSettings}>
            {t('settings.open')}
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
