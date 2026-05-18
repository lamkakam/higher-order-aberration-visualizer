import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import NativeSelect from '@mui/material/NativeSelect';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n, { cachedLanguageKey } from '../i18n';

interface AppHeaderProps {
  readonly onOpenSettings: () => void;
}

export function AppHeader({ onOpenSettings }: AppHeaderProps) {
  const { t } = useTranslation();
  const languageSelectId = useId();
  const [languageMode, setLanguageMode] = useState<'browser' | 'en'>(() =>
    window.localStorage.getItem(cachedLanguageKey) === 'en' ? 'en' : 'browser'
  );

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
              value={languageMode}
              onChange={(event) => {
                const nextMode = event.target.value === 'en' ? 'en' : 'browser';
                setLanguageMode(nextMode);

                if (nextMode === 'browser') {
                  window.localStorage.removeItem(cachedLanguageKey);
                  void i18n.changeLanguage();
                  return;
                }

                void i18n.changeLanguage('en');
              }}
              inputProps={{
                id: languageSelectId,
                'aria-label': t('language.label')
              }}
            >
              <option value="browser">{t('language.browserDefault')}</option>
              <option value="en">{t('language.english')}</option>
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
