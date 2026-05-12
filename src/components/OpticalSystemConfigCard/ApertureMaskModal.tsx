import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Modal from '@mui/material/Modal';
import Typography from '@mui/material/Typography';
import { useId, useMemo } from 'react';
import type { ApertureMaskResult, ApertureSettings } from '../../workers/types';
import {
  ApertureShapeControls,
  CentralObstructionControls,
  GaussianApodizationControls,
  SpiderVaneControls
} from './ApertureMaskControls';
import {
  getApertureMaskModalDraftKey,
  getApertureMaskVisibility,
  normalizeApertureMaskDraft,
  type ApertureMaskVisibility
} from './apertureMaskRules';
import { type ApertureMaskDraft, useApertureMaskDraft } from './hooks/useApertureMaskDraft';
import { useApertureMaskPreview } from './hooks/useApertureMaskPreview';

interface ApertureMaskModalProps {
  readonly open: boolean;
  readonly apertureSettings: ApertureSettings;
  readonly onCancel: () => void;
  readonly onConfirm: (value: ApertureSettings) => void;
  readonly onRenderApertureMask: (value: ApertureSettings) => Promise<ApertureMaskResult>;
}

export function ApertureMaskModal({
  open,
  apertureSettings,
  onCancel,
  onConfirm,
  onRenderApertureMask
}: ApertureMaskModalProps) {
  const titleId = useId();

  return (
    <Modal open={open} aria-labelledby={titleId} onClose={() => {}}>
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
          maxWidth: { xs: 'none', sm: 520 },
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
          Aperture Mask
        </Typography>
        {open ? (
          <ApertureMaskModalDraft
            key={getApertureMaskModalDraftKey(apertureSettings)}
            apertureSettings={apertureSettings}
            onCancel={onCancel}
            onConfirm={onConfirm}
            onRenderApertureMask={onRenderApertureMask}
          />
        ) : undefined}
      </Box>
    </Modal>
  );
}

interface ApertureMaskModalDraftProps {
  readonly apertureSettings: ApertureSettings;
  readonly onCancel: () => void;
  readonly onConfirm: (value: ApertureSettings) => void;
  readonly onRenderApertureMask: (value: ApertureSettings) => Promise<ApertureMaskResult>;
}

function ApertureMaskModalDraft({
  apertureSettings,
  onCancel,
  onConfirm,
  onRenderApertureMask
}: ApertureMaskModalDraftProps) {
  const shapeId = useId();
  const obstructionShapeId = useId();
  const draft = useApertureMaskDraft(apertureSettings);
  const draftSettings = useMemo(() => normalizeApertureMaskDraft(draft.state), [draft.state]);
  const visibility = getApertureMaskVisibility(draft.state, draftSettings);

  return (
    <>
      <ApertureMaskModalContent
        shapeId={shapeId}
        obstructionShapeId={obstructionShapeId}
        draft={draft}
        visibility={visibility}
        draftSettings={draftSettings}
        onRenderApertureMask={onRenderApertureMask}
      />
      <ApertureMaskModalFooter
        draftSettings={draftSettings}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    </>
  );
}

interface ApertureMaskModalContentProps {
  readonly shapeId: string;
  readonly obstructionShapeId: string;
  readonly draft: ApertureMaskDraft;
  readonly visibility: ApertureMaskVisibility;
  readonly draftSettings: ApertureSettings | undefined;
  readonly onRenderApertureMask: (value: ApertureSettings) => Promise<ApertureMaskResult>;
}

function ApertureMaskModalContent({
  shapeId,
  obstructionShapeId,
  draft,
  visibility,
  draftSettings,
  onRenderApertureMask
}: ApertureMaskModalContentProps) {
  return (
    <Box
      data-testid="aperture-mask-modal-content"
      style={{
        marginLeft: -16,
        marginRight: -8,
        minHeight: 0,
        overflowY: 'auto',
        paddingLeft: 16,
        paddingRight: 20,
        scrollbarGutter: 'stable'
      }}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        py: 2
      }}
    >
      <ApertureShapeControls
        shapeId={shapeId}
        state={draft.state}
        actions={draft.actions}
        showApertureRotation={visibility.showApertureRotation}
      />
      <CentralObstructionControls
        obstructionShapeId={obstructionShapeId}
        state={draft.state}
        actions={draft.actions}
        visibility={visibility}
      />
      <SpiderVaneControls state={draft.state} actions={draft.actions} />
      <GaussianApodizationControls
        state={draft.state}
        actions={draft.actions}
        showGaussianSigma={visibility.showGaussianSigma}
      />
      <ApertureMaskPreviewPanel
        draftSettings={draftSettings}
        onRenderApertureMask={onRenderApertureMask}
      />
    </Box>
  );
}

interface ApertureMaskPreviewPanelProps {
  readonly draftSettings: ApertureSettings | undefined;
  readonly onRenderApertureMask: (value: ApertureSettings) => Promise<ApertureMaskResult>;
}

function ApertureMaskPreviewPanel({
  draftSettings,
  onRenderApertureMask
}: ApertureMaskPreviewPanelProps) {
  const { preview, previewError, isPreviewLoading } = useApertureMaskPreview(
    draftSettings,
    onRenderApertureMask
  );

  return (
    <>
      <Typography variant="subtitle2" component="p">
        Preview
      </Typography>
      <Box
        data-testid="aperture-mask-preview-panel"
        sx={{
          alignItems: 'center',
          bgcolor: 'background.default',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          display: 'flex',
          height: 280,
          justifyContent: 'center',
          minHeight: 280,
          overflow: 'hidden',
          p: 2
        }}
      >
        {isPreviewLoading ? (
          <Typography variant="body2">Preparing aperture mask...</Typography>
        ) : previewError ? (
          <Typography variant="body2" color="error">
            {previewError}
          </Typography>
        ) : preview ? (
          <Box
            component="img"
            src={preview.imageUrl}
            alt="Aperture mask preview"
            sx={{
              display: 'block',
              height: 'auto',
              maxHeight: 260,
              maxWidth: '100%',
              objectFit: 'contain'
            }}
          />
        ) : (
          <Typography variant="body2">Preparing aperture mask...</Typography>
        )}
      </Box>
    </>
  );
}

interface ApertureMaskModalFooterProps {
  readonly draftSettings: ApertureSettings | undefined;
  readonly onCancel: () => void;
  readonly onConfirm: (value: ApertureSettings) => void;
}

function ApertureMaskModalFooter({
  draftSettings,
  onCancel,
  onConfirm
}: ApertureMaskModalFooterProps) {
  return (
    <Box
      data-testid="aperture-mask-modal-footer"
      style={{ flexShrink: 0 }}
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        gap: 1,
        justifyContent: 'flex-end',
        pt: 2
      }}
    >
      <Button aria-label="Cancel aperture mask" variant="outlined" onClick={onCancel}>
        Cancel
      </Button>
      <Button
        aria-label="Confirm aperture mask"
        variant="contained"
        disabled={!draftSettings}
        onClick={() => {
          if (draftSettings) {
            onConfirm(draftSettings);
          }
        }}
      >
        Confirm
      </Button>
    </Box>
  );
}
