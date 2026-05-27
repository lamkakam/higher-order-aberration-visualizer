import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, type Theme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import type { WorkerDiagnostics } from '../../workers/types';

interface WorkerInitializationMaskProps {
  readonly diagnostics: WorkerDiagnostics;
  readonly theme: Theme;
}

export function WorkerInitializationMask({ diagnostics, theme }: WorkerInitializationMaskProps) {
  const { t } = useTranslation();
  const progressPercent = clampProgressPercent(diagnostics.progressPercent);

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
        <Typography color="text.secondary" sx={{ textAlign: 'center' }}>
          {diagnostics.message}
        </Typography>
        <Stack spacing={1}>
          <LinearProgress
            aria-label={t('status.initializationProgress')}
            value={progressPercent}
            variant="determinate"
          />
          <Typography color="text.secondary" variant="body2" sx={{ textAlign: 'center' }}>
            {progressPercent}%
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
}

function clampProgressPercent(progressPercent: number | undefined): number {
  return Math.min(100, Math.max(0, Math.round(progressPercent ?? 0)));
}
