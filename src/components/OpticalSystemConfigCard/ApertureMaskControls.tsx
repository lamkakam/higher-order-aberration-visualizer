import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import NativeSelect from '@mui/material/NativeSelect';
import Switch from '@mui/material/Switch';
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
  return (
    <>
      <FormControl fullWidth size="small">
        <InputLabel htmlFor={shapeId}>Aperture Shape</InputLabel>
        <NativeSelect
          value={state.shape}
          onChange={(event) => {
            actions.setShape(event.target.value as ApertureShape);
          }}
          inputProps={{
            id: shapeId,
            'aria-label': 'Aperture Shape'
          }}
        >
          {apertureShapeOptions.map((shape) => (
            <option key={shape.value} value={shape.value}>
              {shape.label}
            </option>
          ))}
        </NativeSelect>
      </FormControl>
      {showApertureRotation ? (
        <CommitSlider
          ariaLabel="Aperture Rotation"
          label="Aperture Rotation"
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
  return (
    <>
      <CommitSlider
        ariaLabel="Central Obstruction Ratio"
        label="Central Obstruction Ratio"
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
            <InputLabel htmlFor={obstructionShapeId}>Obstruction Shape</InputLabel>
            <NativeSelect
              value={state.centralObstructionShape}
              onChange={(event) => {
                actions.setCentralObstructionShape(event.target.value as ApertureShape);
              }}
              inputProps={{
                id: obstructionShapeId,
                'aria-label': 'Obstruction Shape'
              }}
            >
              {apertureShapeOptions.map((shape) => (
                <option key={shape.value} value={shape.value}>
                  {shape.label}
                </option>
              ))}
            </NativeSelect>
          </FormControl>
          {visibility.showObstructionRotation ? (
            <CommitSlider
              ariaLabel="Obstruction Rotation"
              label="Obstruction Rotation"
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
  return (
    <>
      <CommitSlider
        ariaLabel="Spider Vanes"
        label="Spider Vanes"
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
        ariaLabel="Vane Width (x Aperture Diameter)"
        label="Vane Width (x Aperture Diameter)"
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
        ariaLabel="Vane Rotation"
        label="Vane Rotation"
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
        label="Gaussian Apodization"
      />
      {showGaussianSigma ? (
        <CommitSlider
          ariaLabel="Standard Deviation (x Aperture Diameter)"
          label="Standard Deviation (x Aperture Diameter)"
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
