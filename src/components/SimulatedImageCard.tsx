import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Modal from '@mui/material/Modal';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';

interface SimulatedImageCardProps {
  readonly imageUrl: string | undefined;
  readonly statusText: string;
  readonly isLoading: boolean;
  readonly error: string | undefined;
  readonly title?: string;
  readonly description?: string;
  readonly altText?: string;
}

export function SimulatedImageCard({
  imageUrl,
  statusText,
  isLoading,
  error,
  title = 'Simulated Image',
  description = 'The convolved target image updates automatically as aperture diameter, target, and Zernike aberration values change.',
  altText = 'Convolved simulated target'
}: SimulatedImageCardProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const canPreviewImage = Boolean(imageUrl && !error);

  useEffect(() => {
    if (!canPreviewImage) {
      setIsPreviewOpen(false);
    }
  }, [canPreviewImage]);

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box
          sx={{
            alignItems: 'center',
            bgcolor: 'background.default',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            display: 'flex',
            height: '25vh',
            justifyContent: 'center',
            minHeight: 160,
            overflow: 'hidden'
          }}
        >
          {imageUrl && !error ? (
            <Box
              component="button"
              type="button"
              aria-label={`Open enlarged ${title} image`}
              onClick={() => {
                setIsPreviewOpen(true);
              }}
              sx={{
                alignItems: 'center',
                appearance: 'none',
                bgcolor: 'transparent',
                border: 0,
                cursor: 'zoom-in',
                display: 'flex',
                height: '100%',
                justifyContent: 'center',
                p: 0,
                width: '100%'
              }}
            >
              <Box
                component="img"
                src={imageUrl}
                alt={altText}
                sx={{ height: '100%', objectFit: 'contain', width: '100%' }}
              />
            </Box>
          ) : (
            <Typography color={error ? 'error' : 'text.secondary'}>
              {error ?? (isLoading ? 'Preparing simulation' : statusText)}
            </Typography>
          )}
        </Box>
        <Typography variant="h5" component="h2">
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </CardContent>
      <Modal
        open={canPreviewImage && isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
        }}
        aria-label={`${title} image preview`}
      >
        <Box
          role="dialog"
          aria-label={`${title} image preview`}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsPreviewOpen(false);
            }
          }}
          sx={{
            alignItems: 'center',
            display: 'flex',
            inset: 0,
            justifyContent: 'center',
            p: 2,
            position: 'fixed'
          }}
        >
          <Box
            component="img"
            src={imageUrl}
            alt={altText}
            sx={{
              height: 'auto',
              maxHeight: 'calc(100vh - 2rem)',
              maxWidth: 'calc(100vw - 2rem)',
              objectFit: 'contain',
              width: 'auto'
            }}
          />
          <Button
            aria-label="Close image preview"
            disableRipple
            variant="contained"
            onClick={() => {
              setIsPreviewOpen(false);
            }}
            sx={{
              position: 'fixed',
              right: 16,
              top: 16
            }}
          >
            Close image preview
          </Button>
        </Box>
      </Modal>
    </Card>
  );
}
