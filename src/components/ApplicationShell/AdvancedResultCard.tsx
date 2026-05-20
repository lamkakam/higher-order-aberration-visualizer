import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import { type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ImageResultDetailsContent,
  ImageResultPreview,
  type ImageResultPanelProps
} from '../SimulatedImageCard';

export type AdvancedResultPanel = ImageResultPanelProps & {
  readonly id: string;
};

interface AdvancedResultCardProps {
  readonly panels: readonly AdvancedResultPanel[];
  readonly sharedAboveAccordionContent?: ReactNode;
}

export function AdvancedResultCard({
  panels,
  sharedAboveAccordionContent
}: AdvancedResultCardProps) {
  const { t } = useTranslation();
  const gridTemplateColumns = `repeat(${panels.length}, minmax(0, 1fr))`;
  const showSharedEnlargementHint = panels.some(
    (panel) => !panel.error && (panel.isLoading || (Boolean(panel.imageUrl) && !panel.isLoading))
  );
  const accordionId = useId();

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns }}>
          {panels.map((panel) => (
            <ImageResultPreview key={panel.id} {...panel} />
          ))}
        </Box>
        {sharedAboveAccordionContent}
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
            aria-label={t('results.imageDescriptions')}
            expandIcon={<ExpandMoreIcon />}
            id={`${accordionId}-header`}
          >
            <Typography variant="h6" component="span">
              {t('results.imageDescriptions')}
            </Typography>
          </AccordionSummary>
          <AccordionDetails
            id={`${accordionId}-content`}
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns,
              pt: 0
            }}
          >
            {panels.map((panel, index) => {
              const title = panel.title ?? t('results.simulatedImage');

              return (
                <Box
                  key={panel.id}
                  role="group"
                  aria-label={t('results.descriptionGroup', { title })}
                  sx={{
                    borderLeft: index === 0 ? 0 : 1,
                    borderColor: 'divider',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                    px: 2,
                    '&:first-of-type': {
                      pl: 0
                    }
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontSize: '1rem' }}>
                    {title}
                  </Typography>
                  <ImageResultDetailsContent
                    description={panel.description ?? t('results.simulatedDescription')}
                    supplementalDescription={panel.supplementalDescription}
                    showEnlargementHint={false}
                    bottomContent={panel.bottomContent}
                  />
                </Box>
              );
            })}
            {showSharedEnlargementHint ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ gridColumn: '1 / -1' }}
              >
                {t('results.enlargementHint')}
              </Typography>
            ) : undefined}
          </AccordionDetails>
        </Accordion>
      </CardContent>
    </Card>
  );
}
