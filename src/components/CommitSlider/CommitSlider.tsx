import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { TouchSafeSlider } from '../TouchSafeSlider';

interface ScrollPosition {
  readonly x: number;
  readonly y: number;
}

interface CommitSliderInputConfig {
  readonly formatValue: (value: number) => string;
  readonly parseDraft: (draft: string) => number;
  readonly isDraftAllowed: (draft: string) => boolean;
  readonly isValidDraft: (draft: string, parsedValue: number) => boolean;
  readonly getErrorText?: (draft: string, parsedValue: number) => string | undefined;
  readonly inputMode?: 'decimal' | 'numeric';
  readonly inputMin?: number;
  readonly inputMax?: number;
  readonly inputStep?: number;
  readonly testId?: string;
}

interface CommitSliderProps {
  readonly ariaLabel: string;
  readonly label?: ReactNode;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly value: number;
  readonly input?: CommitSliderInputConfig;
  readonly inputSyncKey?: string | number;
  readonly valueLabelDisplay?: 'auto' | 'off' | 'on';
  readonly valueLabelFormat?: (value: number) => string;
  readonly roundValue: (value: number) => number;
  readonly onPreview?: (value: number) => void;
  readonly onCommit: (value: number) => void;
}

export function CommitSlider({
  ariaLabel,
  label,
  min,
  max,
  step,
  value,
  input,
  inputSyncKey,
  valueLabelDisplay = 'auto',
  valueLabelFormat,
  roundValue,
  onPreview,
  onCommit
}: CommitSliderProps) {
  const [draftValue, setDraftValue] = useState(value);
  const [inputDraft, setInputDraft] = useState(input?.formatValue(value) ?? '');
  const committedValueRef = useRef(value);
  const draftValueRef = useRef(value);
  const valueRef = useRef(value);
  const inputSyncKeyRef = useRef(inputSyncKey);
  const keyboardSlidingRef = useRef(false);
  const inputFocusScrollPositionRef = useRef<ScrollPosition | undefined>(undefined);

  if (valueRef.current !== value || inputSyncKeyRef.current !== inputSyncKey) {
    valueRef.current = value;
    committedValueRef.current = value;
    inputSyncKeyRef.current = inputSyncKey;
    draftValueRef.current = value;
    setDraftValue(value);
    setInputDraft(input?.formatValue(value) ?? '');
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
    setInputDraft(input?.formatValue(roundedValue) ?? '');
    onCommit(roundedValue);
  }

  function commitInputDraft() {
    if (!input) {
      return;
    }

    const parsedValue = input.parseDraft(inputDraft);
    if (!input.isValidDraft(inputDraft, parsedValue)) {
      return;
    }

    commit(parsedValue);
  }

  function getInputDisplayValue() {
    if (!input) {
      return Number.NaN;
    }

    const numericDraft = Number(inputDraft);
    if (Number.isFinite(numericDraft)) {
      return numericDraft;
    }

    return Number(input.formatValue(committedValueRef.current));
  }

  function getDisplayStepPrecision(value: number) {
    const [, fraction = ''] = value.toString().split('.');

    return fraction.length;
  }

  function getSteppedDisplayValue(direction: -1 | 1) {
    if (!input) {
      return Number.NaN;
    }

    const displayStep = input.inputStep ?? step;
    const precision = getDisplayStepPrecision(displayStep);
    const nextDisplayValue = getInputDisplayValue() + direction * displayStep;

    return Number(nextDisplayValue.toFixed(precision));
  }

  function canStepInput(direction: -1 | 1) {
    if (!input) {
      return false;
    }

    const nextDisplayValue = getSteppedDisplayValue(direction);
    if (!Number.isFinite(nextDisplayValue)) {
      return false;
    }

    const inputMin = input.inputMin ?? min;
    const inputMax = input.inputMax ?? max;

    return nextDisplayValue >= inputMin && nextDisplayValue <= inputMax;
  }

  function commitInputStep(direction: -1 | 1) {
    if (!input || !canStepInput(direction)) {
      return;
    }

    commit(input.parseDraft(String(getSteppedDisplayValue(direction))));
  }

  function isIosSafari() {
    const { maxTouchPoints, userAgent } = window.navigator;
    const isIos = /iP(?:ad|hone|od)/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
    const isSafari = /Safari/.test(userAgent) && !/(?:CriOS|FxiOS|EdgiOS)/.test(userAgent);

    return isIos && isSafari;
  }

  function rememberInputFocusScrollPosition() {
    if (!isIosSafari()) {
      inputFocusScrollPositionRef.current = undefined;
      return;
    }

    inputFocusScrollPositionRef.current = {
      x: window.scrollX,
      y: window.scrollY
    };
  }

  function restoreInputFocusScrollPosition() {
    const scrollPosition = inputFocusScrollPositionRef.current;
    inputFocusScrollPositionRef.current = undefined;

    if (!scrollPosition || !isIosSafari()) {
      return;
    }

    window.requestAnimationFrame(() => {
      window.scrollTo(scrollPosition.x, scrollPosition.y);
    });
  }

  const parsedInputValue = input?.parseDraft(inputDraft) ?? Number.NaN;
  const inputErrorText = input?.getErrorText?.(inputDraft, parsedInputValue);
  const canDecreaseInput = canStepInput(-1);
  const canIncreaseInput = canStepInput(1);

  return (
    <Box>
      {input || label ? (
        <Box
          sx={{
            alignItems: 'flex-start',
            display: 'flex',
            gap: 2,
            justifyContent: 'space-between'
          }}
        >
          <Typography
            variant="body2"
            component="div"
            sx={{ flex: '1 1 auto', minWidth: 0 }}
          >
            {label ?? ariaLabel}
          </Typography>
          {input ? (
            <Box
              sx={{
                alignItems: 'flex-start',
                display: 'flex',
                flexShrink: 0
              }}
            >
              <IconButton
                aria-label={`Decrease ${ariaLabel}`}
                disabled={!canDecreaseInput}
                size="small"
                sx={{
                  '&.Mui-disabled': {
                    cursor: 'not-allowed',
                    pointerEvents: 'auto'
                  }
                }}
                onClick={() => {
                  commitInputStep(-1);
                }}
              >
                <RemoveIcon fontSize="inherit" />
              </IconButton>
              <TextField
                data-testid={input.testId}
                autoComplete="off"
                error={Boolean(inputErrorText)}
                helperText={inputErrorText}
                inputMode={input.inputMode}
                size="small"
                sx={{
                  flexShrink: 0,
                  '& input': {
                    py: 0.5,
                    textAlign: 'right'
                  }
                }}
                type="text"
                value={inputDraft}
                onChange={(event) => {
                  const nextDraft = event.target.value;
                  if (input.isDraftAllowed(nextDraft)) {
                    setInputDraft(nextDraft);
                  }
                }}
                onBlur={() => {
                  commitInputDraft();
                  restoreInputFocusScrollPosition();
                }}
                onFocus={rememberInputFocusScrollPosition}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    commitInputDraft();
                  }
                }}
                slotProps={{
                  htmlInput: {
                    'aria-label': ariaLabel,
                    autoComplete: 'off',
                    min: input.inputMin ?? min,
                    max: input.inputMax ?? max,
                    step: input.inputStep ?? step,
                    style: {
                      maxWidth: '3em',
                      minWidth: '3em',
                      width: '3em'
                    }
                  }
                }}
              />
              <IconButton
                aria-label={`Increase ${ariaLabel}`}
                disabled={!canIncreaseInput}
                size="small"
                sx={{
                  '&.Mui-disabled': {
                    cursor: 'not-allowed',
                    pointerEvents: 'auto'
                  }
                }}
                onClick={() => {
                  commitInputStep(1);
                }}
              >
                <AddIcon fontSize="inherit" />
              </IconButton>
            </Box>
          ) : undefined}
        </Box>
      ) : undefined}
      <TouchSafeSlider
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
    </Box>
  );
}
