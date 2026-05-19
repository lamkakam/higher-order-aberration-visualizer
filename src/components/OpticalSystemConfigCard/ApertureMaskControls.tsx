import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import NativeSelect from '@mui/material/NativeSelect';
import Switch from '@mui/material/Switch';
import { useTranslation } from 'react-i18next';
import type { ApertureShape } from '../../workers/types';
import { CommitSlider } from '../CommitSlider';
import {
  apertureShapeOptions,
  formatRatioValue,
  gaussianSigmaRatioSliderInput,
  ratioSliderInput,
  rotationSliderInput,
  spiderVaneCountSliderInput,
  spiderVaneWidthRatioSliderInput,
  type ApertureMaskDraftState,
  type ApertureMaskVisibility
} from './apertureMaskRules';

export interface ApertureMaskDraftActions {
  readonly setShape: (value: ApertureShape) => void;
  readonly setRotationDegrees: (value: number) => void;
  readonly setCentralObstructionRatio: (value: number) => void;
  readonly setCentralObstructionShape: (value: ApertureShape) => void;
  readonly setCentralObstructionRotationDegrees: (value: number) => void;
  readonly setGaussianApodizationEnabled: (value: boolean) => void;
  readonly setGaussianApodizationSigmaRatio: (value: number) => void;
  readonly setSpiderVaneCount: (value: number) => void;
  readonly setSpiderVaneWidthRatio: (value: number) => void;
  readonly setSpiderVaneRotationDegrees: (value: number) => void;
}

interface ApertureShapeControlsProps {
  readonly shapeId: string;
  readonly state: ApertureMaskDraftState;
  readonly actions: ApertureMaskDraftActions;
  readonly showApertureRotation: boolean;
}

export function ApertureShapeControls({
  shapeId,
  state,
  actions,
  showApertureRotation
}: ApertureShapeControlsProps) {
  const { t } = useTranslation();

  return (
    <>
      <FormControl fullWidth size="small">
        <InputLabel htmlFor={shapeId}>{t('apertureMask.shape')}</InputLabel>
        <NativeSelect
          value={state.shape}
          onChange={(event) => {
            actions.setShape(event.target.value as ApertureShape);
          }}
          inputProps={{
            id: shapeId,
            'aria-label': t('apertureMask.shape')
          }}
        >
          {apertureShapeOptions.map((shape) => (
            <option key={shape.value} value={shape.value}>
              {t(shape.labelKey)}
            </option>
          ))}
        </NativeSelect>
      </FormControl>
      {showApertureRotation ? (
        <CommitSlider
          ariaLabel={t('apertureMask.rotation')}
          label={t('apertureMask.rotation')}
          min={0}
          max={360}
          step={1}
          value={state.rotationDegrees}
          input={rotationSliderInput}
          valueLabelDisplay="auto"
          valueLabelFormat={(value) => `${value.toFixed(0)} deg`}
          roundValue={Math.round}
          onCommit={actions.setRotationDegrees}
        />
      ) : undefined}
    </>
  );
}

interface CentralObstructionControlsProps {
  readonly obstructionShapeId: string;
  readonly state: ApertureMaskDraftState;
  readonly actions: ApertureMaskDraftActions;
  readonly visibility: ApertureMaskVisibility;
}

export function CentralObstructionControls({
  obstructionShapeId,
  state,
  actions,
  visibility
}: CentralObstructionControlsProps) {
  const { t } = useTranslation();

  return (
    <>
      <CommitSlider
        ariaLabel={t('apertureMask.centralObstructionRatio')}
        label={t('apertureMask.centralObstructionRatio')}
        min={0}
        max={0.99}
        step={0.01}
        value={state.centralObstructionRatio}
        input={ratioSliderInput}
        valueLabelDisplay="auto"
        valueLabelFormat={formatRatioValue}
        roundValue={roundRatioValue}
        onCommit={actions.setCentralObstructionRatio}
      />
      {visibility.showObstructionControls ? (
        <>
          <FormControl fullWidth size="small">
            <InputLabel htmlFor={obstructionShapeId}>{t('apertureMask.obstructionShape')}</InputLabel>
            <NativeSelect
              value={state.centralObstructionShape}
              onChange={(event) => {
                actions.setCentralObstructionShape(event.target.value as ApertureShape);
              }}
              inputProps={{
                id: obstructionShapeId,
                'aria-label': t('apertureMask.obstructionShape')
              }}
            >
              {apertureShapeOptions.map((shape) => (
                <option key={shape.value} value={shape.value}>
                  {t(shape.labelKey)}
                </option>
              ))}
            </NativeSelect>
          </FormControl>
          {visibility.showObstructionRotation ? (
            <CommitSlider
              ariaLabel={t('apertureMask.obstructionRotation')}
              label={t('apertureMask.obstructionRotation')}
              min={0}
              max={360}
              step={1}
              value={state.centralObstructionRotationDegrees}
              input={rotationSliderInput}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${value.toFixed(0)} deg`}
              roundValue={Math.round}
              onCommit={actions.setCentralObstructionRotationDegrees}
            />
          ) : undefined}
        </>
      ) : undefined}
    </>
  );
}

interface SpiderVaneControlsProps {
  readonly state: ApertureMaskDraftState;
  readonly actions: ApertureMaskDraftActions;
}

export function SpiderVaneControls({ state, actions }: SpiderVaneControlsProps) {
  const { t } = useTranslation();

  return (
    <>
      <CommitSlider
        ariaLabel={t('apertureMask.spiderVanes')}
        label={t('apertureMask.spiderVanes')}
        min={0}
        max={12}
        step={1}
        value={state.spiderVaneCount}
        input={spiderVaneCountSliderInput}
        valueLabelDisplay="auto"
        valueLabelFormat={(value) => value.toFixed(0)}
        roundValue={Math.round}
        onCommit={actions.setSpiderVaneCount}
      />
      <CommitSlider
        ariaLabel={t('apertureMask.vaneWidth')}
        label={t('apertureMask.vaneWidth')}
        min={0}
        max={0.25}
        step={0.01}
        value={state.spiderVaneWidthRatio}
        input={spiderVaneWidthRatioSliderInput}
        valueLabelDisplay="auto"
        valueLabelFormat={(value) => `${formatRatioValue(value)}D`}
        roundValue={roundRatioValue}
        onCommit={actions.setSpiderVaneWidthRatio}
      />
      <CommitSlider
        ariaLabel={t('apertureMask.vaneRotation')}
        label={t('apertureMask.vaneRotation')}
        min={0}
        max={360}
        step={1}
        value={state.spiderVaneRotationDegrees}
        input={rotationSliderInput}
        valueLabelDisplay="auto"
        valueLabelFormat={(value) => `${value.toFixed(0)} deg`}
        roundValue={Math.round}
        onCommit={actions.setSpiderVaneRotationDegrees}
      />
    </>
  );
}

interface GaussianApodizationControlsProps {
  readonly state: ApertureMaskDraftState;
  readonly actions: ApertureMaskDraftActions;
  readonly showGaussianSigma: boolean;
}

export function GaussianApodizationControls({
  state,
  actions,
  showGaussianSigma
}: GaussianApodizationControlsProps) {
  const { t } = useTranslation();

  return (
    <>
      <FormControlLabel
        control={
          <Switch
            checked={state.gaussianApodizationEnabled}
            onChange={(event) => {
              actions.setGaussianApodizationEnabled(event.target.checked);
            }}
          />
        }
        label={t('apertureMask.gaussianApodization')}
      />
      {showGaussianSigma ? (
        <CommitSlider
          ariaLabel={t('apertureMask.standardDeviation')}
          label={t('apertureMask.standardDeviation')}
          min={0.05}
          max={1}
          step={0.01}
          value={state.gaussianApodizationSigmaRatio}
          input={gaussianSigmaRatioSliderInput}
          valueLabelDisplay="auto"
          valueLabelFormat={(value) => `${formatRatioValue(value)}D`}
          roundValue={roundRatioValue}
          onCommit={actions.setGaussianApodizationSigmaRatio}
        />
      ) : undefined}
    </>
  );
}

function roundRatioValue(value: number): number {
  return Math.round(value * 100) / 100;
}
