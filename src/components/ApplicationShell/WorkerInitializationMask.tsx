import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, type Theme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';

interface WorkerInitializationMaskProps {
  readonly theme: Theme;
}

export function WorkerInitializationMask({ theme }: WorkerInitializationMaskProps) {
  const { t } = useTranslation();

  return (
    <Box
      role="status"
      aria-label={t('status.workerInitialization')}
      sx={{
        alignItems: 'center',
        backdropFilter: 'blur(2px)',
        bgcolor: alpha(theme.palette.background.default, 0.86),
        display: 'flex',
        inset: 0,
        justifyContent: 'center',
        p: 3,
        position: 'fixed',
        zIndex: theme.zIndex.modal + 1
      }}
    >
      <Stack spacing={2} sx={{ width: 'min(320px, 100%)' }}>
        <Typography variant="h6" component="p" sx={{ textAlign: 'center' }}>
          {t('status.initializing')}
        </Typography>
        <LinearProgress aria-label={t('status.initializationProgress')} />
      </Stack>
    </Box>
  );
}
