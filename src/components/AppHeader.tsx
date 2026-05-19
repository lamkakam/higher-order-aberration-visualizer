import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';

interface AppHeaderProps {
  readonly onOpenSettings: () => void;
}

export function AppHeader({ onOpenSettings }: AppHeaderProps) {
  const { t } = useTranslation();

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
          <Button aria-label={t('settings.open')} variant="contained" onClick={onOpenSettings}>
            {t('settings.open')}
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
