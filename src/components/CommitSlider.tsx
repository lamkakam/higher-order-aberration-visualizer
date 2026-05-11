import Slider from '@mui/material/Slider';
import { useRef, useState } from 'react';

interface CommitSliderProps {
  readonly ariaLabel: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly value: number;
  readonly valueLabelDisplay?: 'auto' | 'off' | 'on';
  readonly valueLabelFormat?: (value: number) => string;
  readonly roundValue: (value: number) => number;
  readonly onPreview?: (value: number) => void;
  readonly onCommit: (value: number) => void;
}

export function CommitSlider({
  ariaLabel,
  min,
  max,
  step,
  value,
  valueLabelDisplay = 'auto',
  valueLabelFormat,
  roundValue,
  onPreview,
  onCommit
}: CommitSliderProps) {
  const [draftValue, setDraftValue] = useState(value);
  const committedValueRef = useRef(value);
  const draftValueRef = useRef(value);
  const keyboardSlidingRef = useRef(false);

  if (committedValueRef.current !== value) {
    committedValueRef.current = value;
    draftValueRef.current = value;
    setDraftValue(value);
  }

  function preview(nextValue: number, eventType: string) {
    const roundedValue = roundValue(nextValue);
    if (eventType === 'keydown') {
      keyboardSlidingRef.current = true;
    }
    draftValueRef.current = roundedValue;
    setDraftValue(roundedValue);
    onPreview?.(roundedValue);
  }

  function commit(nextValue: number) {
    const roundedValue = roundValue(nextValue);
    committedValueRef.current = roundedValue;
    draftValueRef.current = roundedValue;
    setDraftValue(roundedValue);
    onCommit(roundedValue);
  }

  return (
    <Slider
      aria-label={ariaLabel}
      min={min}
      max={max}
      step={step}
      value={draftValue}
      valueLabelDisplay={valueLabelDisplay}
      valueLabelFormat={valueLabelFormat}
      onChange={(event, nextValue) => {
        preview(Array.isArray(nextValue) ? nextValue[0] : nextValue, event.type);
      }}
      onChangeCommitted={(_, nextValue) => {
        if (keyboardSlidingRef.current) {
          return;
        }

        commit(Array.isArray(nextValue) ? nextValue[0] : nextValue);
      }}
      onKeyDown={() => {
        keyboardSlidingRef.current = true;
      }}
      onKeyUp={() => {
        if (keyboardSlidingRef.current) {
          keyboardSlidingRef.current = false;
          commit(draftValueRef.current);
        }
      }}
    />
  );
}
