import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Modal from '@mui/material/Modal';
import Typography from '@mui/material/Typography';
import { type ReactNode, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface SimulatedImageCardProps {
  readonly imageUrl: string | undefined;
  readonly statusText: string;
  readonly isLoading: boolean;
  readonly error: string | undefined;
  readonly title?: string;
  readonly description?: string;
  readonly supplementalDescription?: string;
  readonly altText?: string;
  readonly aboveAccordionContent?: ReactNode;
  readonly bottomContent?: ReactNode;
}

export interface ImageResultPanelProps extends SimulatedImageCardProps {}

interface PreviewableImageProps {
  readonly imageUrl: string;
  readonly title: string;
  readonly altText: string;
}

function PreviewableImage({ imageUrl, title, altText }: PreviewableImageProps) {
  const { t } = useTranslation();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  return (
    <>
      <Box
        component="button"
        type="button"
        aria-label={t('results.openEnlarged', { title })}
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
      <Modal
        open={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
        }}
        aria-label={t('results.enlargedDialog', { title })}
      >
        <Box
          role="dialog"
          aria-label={t('results.enlargedDialog', { title })}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsPreviewOpen(false);
            }
          }}
          sx={{
            alignItems: 'center',
            bgcolor: 'background.default',
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
            aria-label={t('results.closeEnlarged')}
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
            {t('results.closeEnlarged')}
          </Button>
        </Box>
      </Modal>
    </>
  );
}

function getPreviewImageUrl(
  imageUrl: string | undefined,
  error: string | undefined,
  isLoading: boolean
) {
  return imageUrl && !error && !isLoading ? imageUrl : undefined;
}

function shouldShowEnlargementHint(
  previewImageUrl: string | undefined,
  error: string | undefined,
  isLoading: boolean
) {
  return !error && (Boolean(previewImageUrl) || isLoading);
}

export function ImageResultPreview({
  imageUrl,
  statusText,
  isLoading,
  error,
  title,
  altText
}: Pick<
  ImageResultPanelProps,
  'imageUrl' | 'statusText' | 'isLoading' | 'error' | 'title' | 'altText'
>) {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('results.simulatedImage');
  const resolvedAltText = altText ?? t('results.convolvedAlt');
  const previewImageUrl = getPreviewImageUrl(imageUrl, error, isLoading);

  return (
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
      {previewImageUrl ? (
        <PreviewableImage imageUrl={previewImageUrl} title={resolvedTitle} altText={resolvedAltText} />
      ) : (
        <Typography color={error ? 'error' : 'text.secondary'}>
          {error ?? (isLoading ? t('status.preparingImage') : statusText)}
        </Typography>
      )}
    </Box>
  );
}

export function ImageResultDetailsAccordion({
  imageUrl,
  isLoading,
  error,
  title,
  description,
  supplementalDescription,
  aboveAccordionContent,
  bottomContent
}: Pick<
  ImageResultPanelProps,
  | 'imageUrl'
  | 'isLoading'
  | 'error'
  | 'title'
  | 'description'
  | 'supplementalDescription'
  | 'aboveAccordionContent'
  | 'bottomContent'
>) {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('results.simulatedImage');
  const resolvedDescription = description ?? t('results.simulatedDescription');
  const previewImageUrl = getPreviewImageUrl(imageUrl, error, isLoading);
  const showEnlargementHint = shouldShowEnlargementHint(previewImageUrl, error, isLoading);
  const accordionId = useId();

  return (
    <>
      {aboveAccordionContent}
      <Accordion
        defaultExpanded
        disableGutters
        sx={{
          '&::before': {
            display: 'none'
          },
          border: 1,
          borderColor: 'divider',
          boxShadow: 'none'
        }}
      >
        <AccordionSummary
          aria-controls={`${accordionId}-content`}
          aria-label={resolvedTitle}
          expandIcon={<ExpandMoreIcon />}
          id={`${accordionId}-header`}
        >
          <Typography variant="h6" component="span">
            {resolvedTitle}
          </Typography>
        </AccordionSummary>
        <AccordionDetails
          id={`${accordionId}-content`}
          sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 0 }}
        >
          <ImageResultDetailsContent
            description={resolvedDescription}
            supplementalDescription={supplementalDescription}
            showEnlargementHint={showEnlargementHint}
            bottomContent={bottomContent}
          />
        </AccordionDetails>
      </Accordion>
    </>
  );
}

interface ImageResultDetailsContentProps {
  readonly description: string;
  readonly supplementalDescription: string | undefined;
  readonly showEnlargementHint: boolean;
  readonly bottomContent: ReactNode | undefined;
}

export function ImageResultDetailsContent({
  description,
  supplementalDescription,
  showEnlargementHint,
  bottomContent
}: ImageResultDetailsContentProps) {
  const { t } = useTranslation();

  return (
    <>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
      {supplementalDescription ? (
        <Typography variant="body2" color="text.secondary">
          {supplementalDescription}
        </Typography>
      ) : undefined}
      {showEnlargementHint ? (
        <Typography variant="body2" color="text.secondary">
          {t('results.enlargementHint')}
        </Typography>
      ) : undefined}
      {bottomContent}
    </>
  );
}

export function ImageResultPanel(props: ImageResultPanelProps) {
  return (
    <>
      <ImageResultPreview {...props} />
      <ImageResultDetailsAccordion {...props} />
    </>
  );
}

export function SimulatedImageCard(props: SimulatedImageCardProps) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <ImageResultPanel {...props} />
      </CardContent>
    </Card>
  );
}
