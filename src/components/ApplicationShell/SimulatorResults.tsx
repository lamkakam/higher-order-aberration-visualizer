import Box from '@mui/material/Box';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { SxProps, Theme } from '@mui/material/styles';
import type {
  ConvolvedImageResult,
  SupportedTargetId,
  WavefrontLegendUnit
} from '../../workers/types';
import type { DisplayMode } from '../SettingsDrawer';
import { SimulatedImageCard } from '../SimulatedImageCard';
import { supplementalDescriptions, targetOptions } from '../simulationConfig';
import { AdvancedResultCard, type AdvancedResultPanel } from './AdvancedResultCard';
import {
  advancedGridHalfGapPx,
  desktopStickyTopPx,
  mobileStickyTopPx
} from './defaults';
import { WavefrontLegendUnitControl } from './WavefrontLegendUnitControl';

interface SimulatorResultsProps {
  readonly approximateStrehlContent?: ReactNode;
  readonly diagnosticsMessage: string;
  readonly displayMode: DisplayMode;
  readonly error?: string;
  readonly isImageLoading: boolean;
  readonly isSmUp: boolean;
  readonly result?: ConvolvedImageResult;
  readonly targetId: SupportedTargetId;
  readonly wavefrontLegendUnit: WavefrontLegendUnit;
  readonly onWavefrontLegendUnitChange: (unit: WavefrontLegendUnit) => void;
}

export function SimulatorResults({
  approximateStrehlContent,
  diagnosticsMessage,
  displayMode,
  error,
  isImageLoading,
  isSmUp,
  result,
  targetId,
  wavefrontLegendUnit,
  onWavefrontLegendUnitChange
}: SimulatorResultsProps) {
  const { t } = useTranslation();
  const selectedTarget = targetOptions.find((target) => target.id === targetId) ?? targetOptions[0];
  const selectedTargetDescription = t(`targets.${selectedTarget.id}.description`);
  const simulatedImageDescription = t('results.simulatedDescriptionWithTarget', {
    description: selectedTargetDescription
  });
  const psfSupplementalDescription = supplementalDescriptions[targetId]
    ? t(`targets.${targetId}.supplementalDescription`)
    : undefined;
  const shouldMergeAdvancedResults = displayMode === 'advanced' && isSmUp;
  const stickyImageCardMaskSx = createStickyImageCardMaskSx(displayMode);
  const desktopStickyImageCardMaskSx = {
    ...stickyImageCardMaskSx,
    '&::before': {
      ...stickyImageCardMaskSx['&::before'],
      display: { xs: 'none', sm: 'block' }
    }
  } satisfies SxProps<Theme>;
  const simulatedImagePanel: AdvancedResultPanel = {
    id: 'simulated-image',
    imageUrl: result?.imageUrl,
    statusText: diagnosticsMessage,
    isLoading: isImageLoading,
    error,
    description: simulatedImageDescription,
    aboveAccordionContent: shouldMergeAdvancedResults ? undefined : approximateStrehlContent
  };
  const psfPanel: AdvancedResultPanel = {
    id: 'psf',
    imageUrl: result?.psfImageUrl,
    statusText: diagnosticsMessage,
    isLoading: isImageLoading,
    error,
    title: t('results.psf'),
    description: t('results.psfDescription'),
    supplementalDescription: psfSupplementalDescription,
    altText: t('results.psfAlt')
  };
  const wavefrontPanel: AdvancedResultPanel = {
    id: 'wavefront-map',
    imageUrl: result?.wavefrontImageUrl,
    statusText: diagnosticsMessage,
    isLoading: isImageLoading,
    error,
    title: t('results.wavefrontMap'),
    description: t('results.wavefrontDescription'),
    altText: t('results.wavefrontAlt'),
    bottomContent: (
      <WavefrontLegendUnitControl
        wavefrontLegendUnit={wavefrontLegendUnit}
        onWavefrontLegendUnitChange={onWavefrontLegendUnitChange}
      />
    )
  };
  const advancedResultPanels =
    targetId === 'point_source'
      ? ([simulatedImagePanel, wavefrontPanel] as const)
      : ([simulatedImagePanel, psfPanel, wavefrontPanel] as const);

  if (shouldMergeAdvancedResults) {
    return (
      <Box
        sx={{
          ...stickyImageCardMaskSx,
          alignSelf: 'stretch',
          position: 'sticky',
          top: desktopStickyTopPx,
          zIndex: 3
        }}
      >
        <AdvancedResultCard
          panels={advancedResultPanels}
          sharedAboveAccordionContent={approximateStrehlContent}
        />
      </Box>
    );
  }

  return (
    <>
      <Box
        sx={{
          ...stickyImageCardMaskSx,
          alignSelf: { xs: 'start', sm: 'stretch' },
          position: 'sticky',
          top: { xs: mobileStickyTopPx, sm: desktopStickyTopPx },
          zIndex: 3
        }}
      >
        <SimulatedImageCard {...simulatedImagePanel} />
      </Box>
      {displayMode === 'advanced' && targetId !== 'point_source' ? (
        <Box
          sx={{
            ...desktopStickyImageCardMaskSx,
            alignSelf: { xs: 'start', sm: 'stretch' },
            position: { xs: 'static', sm: 'sticky' },
            top: { sm: desktopStickyTopPx },
            zIndex: { sm: 2 }
          }}
        >
          <SimulatedImageCard {...psfPanel} />
        </Box>
      ) : undefined}
      {displayMode === 'advanced' ? (
        <Box
          sx={{
            ...desktopStickyImageCardMaskSx,
            alignSelf: { xs: 'start', sm: 'stretch' },
            position: { xs: 'static', sm: 'sticky' },
            top: { sm: desktopStickyTopPx },
            zIndex: { sm: 2 }
          }}
        >
          <SimulatedImageCard {...wavefrontPanel} />
        </Box>
      ) : undefined}
    </>
  );
}

function createStickyImageCardMaskSx(displayMode: DisplayMode) {
  const desktopAdvancedMaskOffset =
    displayMode === 'advanced' ? `-${advancedGridHalfGapPx}px` : 0;

  return {
    '&::before': {
      bgcolor: 'background.default',
      bottom: 0,
      content: '""',
      left: { xs: 0, sm: desktopAdvancedMaskOffset },
      position: 'absolute',
      right: { xs: 0, sm: desktopAdvancedMaskOffset },
      top: { xs: `-${mobileStickyTopPx}px`, sm: `-${desktopStickyTopPx}px` }
    },
    '& > *': {
      position: 'relative',
      zIndex: 1
    }
  } satisfies SxProps<Theme>;
}
