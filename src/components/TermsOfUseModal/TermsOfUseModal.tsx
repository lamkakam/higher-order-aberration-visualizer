import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Modal from '@mui/material/Modal';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

export const termsOfUseAcceptedStorageKey = 'hoaTermsOfUseAccepted';
const termsOfUseHref =
  'https://redirect.github.com/lamkakam/higher-order-aberration-visualizer/blob/main/LICENSE';

interface TermsOfUseModalProps {
  readonly open: boolean;
  readonly onAgree: () => void;
}

export function TermsOfUseModal({ open, onAgree }: TermsOfUseModalProps) {
  const { t } = useTranslation();
  const titleId = useId();

  return (
    <Modal
      open={open}
      aria-labelledby={titleId}
      onClose={() => {}}
      sx={{ zIndex: (theme) => theme.zIndex.modal + 2 }}
    >
      <Box
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        sx={{
          bgcolor: 'background.paper',
          borderRadius: { xs: 0, sm: 1 },
          boxShadow: 24,
          display: 'flex',
          flexDirection: 'column',
          height: { xs: '100vh', sm: 'auto' },
          left: { xs: 0, sm: '50%' },
          maxHeight: { xs: '100vh', sm: 'calc(100vh - 48px)' },
          maxWidth: { xs: 'none', sm: 560 },
          overflow: 'hidden',
          p: { xs: 2, sm: 3 },
          position: 'absolute',
          top: { xs: 0, sm: '50%' },
          transform: { xs: 'none', sm: 'translate(-50%, -50%)' },
          width: { xs: '100%', sm: 'calc(100% - 32px)' },
          '@supports (height: 100dvh)': {
            height: { xs: '100dvh', sm: 'auto' },
            maxHeight: { xs: '100dvh', sm: 'calc(100dvh - 48px)' }
          }
        }}
      >
        <Typography id={titleId} variant="h5" component="h2" sx={{ flexShrink: 0 }}>
          {t('termsOfUse.title')}
        </Typography>
        <Stack
          spacing={2}
          sx={{
            minHeight: 0,
            overflowY: 'auto',
            py: 2,
            scrollbarGutter: 'stable'
          }}
        >
          <Typography variant="body1">{t('termsOfUse.body')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('termsOfUse.fullTermsPrefix')}{' '}
            <Link
              href={termsOfUseHref}
              target="_blank"
              rel="noreferrer"
              aria-label={t('termsOfUse.fullTermsLink')}
            >
              {t('termsOfUse.fullTermsLink')}
            </Link>
            {t('termsOfUse.fullTermsSuffix')}
          </Typography>
        </Stack>
        <Box sx={{ display: 'flex', flexShrink: 0, justifyContent: 'flex-end' }}>
          <Button variant="contained" aria-label={t('termsOfUse.agree')} onClick={onAgree}>
            {t('termsOfUse.agree')}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}
