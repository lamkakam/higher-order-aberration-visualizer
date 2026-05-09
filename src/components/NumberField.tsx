import { NumberField as BaseNumberField } from '@base-ui/react/number-field';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import OutlinedInput from '@mui/material/OutlinedInput';
import { useCallback, useId, useRef, useState } from 'react';

const inputCommitDebounceMs = 150;

interface NumberFieldProps {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly error?: boolean;
  readonly onChange: (value: number) => void;
}

export function NumberField({
  label,
  value,
  min,
  error = false,
  onChange
}: NumberFieldProps) {
  const id = useId();

  return (
    <NumberFieldInput
      id={id}
      label={label}
      value={value}
      min={min}
      error={error}
      onChange={onChange}
    />
  );
}

interface NumberFieldInputProps extends NumberFieldProps {
  readonly id: string;
}

function NumberFieldInput({
  id,
  label,
  value,
  min,
  error = false,
  onChange
}: NumberFieldInputProps) {
  const [draftState, setDraftState] = useState({
    committedValue: value,
    draftValue: String(value),
    draftVersion: 0
  });
  const commitTimerRef = useRef<number | undefined>(undefined);
  let currentDraftState = draftState;

  if (currentDraftState.committedValue !== value) {
    currentDraftState = {
      committedValue: value,
      draftValue: String(value),
      draftVersion: currentDraftState.draftVersion + 1
    };
    setDraftState(currentDraftState);
  }

  const latestCommitInputsRef = useRef({
    draftVersion: currentDraftState.draftVersion,
    min,
    onChange,
    value
  });
  latestCommitInputsRef.current = {
    draftVersion: currentDraftState.draftVersion,
    min,
    onChange,
    value
  };

  const clearCommitTimer = useCallback(() => {
    window.clearTimeout(commitTimerRef.current);
    commitTimerRef.current = undefined;
  }, []);

  const commitDraft = useCallback(
    (nextDraft: string) => {
      const {
        min: latestMin,
        onChange: latestOnChange,
        value: latestValue
      } = latestCommitInputsRef.current;
      const parsedValue = Number(nextDraft);
      if (
        nextDraft.trim() !== '' &&
        Number.isFinite(parsedValue) &&
        parsedValue >= latestMin &&
        parsedValue !== latestValue
      ) {
        latestOnChange(parsedValue);
      }
    },
    []
  );

  const scheduleDraftCommit = useCallback(
    (nextDraft: string, nextDraftVersion: number) => {
      const {
        min: latestMin,
        value: latestValue
      } = latestCommitInputsRef.current;
      const parsedValue = Number(nextDraft);

      clearCommitTimer();
      if (
        nextDraft.trim() !== '' &&
        Number.isFinite(parsedValue) &&
        parsedValue >= latestMin &&
        parsedValue !== latestValue
      ) {
        commitTimerRef.current = window.setTimeout(() => {
          if (latestCommitInputsRef.current.draftVersion === nextDraftVersion) {
            commitDraft(nextDraft);
          }
        }, inputCommitDebounceMs);
      }
    },
    [clearCommitTimer, commitDraft]
  );

  const flushDraft = useCallback(() => {
    clearCommitTimer();
    commitDraft(currentDraftState.draftValue);
  }, [clearCommitTimer, commitDraft, currentDraftState.draftValue]);

  const handleInputRef = useCallback(
    (node: HTMLInputElement | null) => {
      if (node === null) {
        clearCommitTimer();
      }
    },
    [clearCommitTimer]
  );

  const handleInputChange = (nextValue: string) => {
    if (!isDecimalText(nextValue)) {
      return;
    }

    const nextDraftVersion = currentDraftState.draftVersion + 1;
    setDraftState({
      committedValue: value,
      draftValue: nextValue,
      draftVersion: nextDraftVersion
    });
    latestCommitInputsRef.current.draftVersion = nextDraftVersion;
    scheduleDraftCommit(nextValue, nextDraftVersion);
  };

  return (
    <BaseNumberField.Root
      value={value}
      min={min}
      step={0.1}
      onValueChange={(nextValue) => {
        if (typeof nextValue === 'number' && Number.isFinite(nextValue)) {
          onChange(nextValue);
        }
      }}
    >
      <FormControl fullWidth error={error} variant="outlined" size="small">
        <InputLabel htmlFor={id}>{label}</InputLabel>
        <OutlinedInput
          id={id}
          label={label}
          type="text"
          value={currentDraftState.draftValue}
          inputProps={{ inputMode: 'decimal', min, step: 0.1 }}
          inputRef={handleInputRef}
          onChange={(event) => {
            handleInputChange(event.target.value);
          }}
          onBlur={flushDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              flushDraft();
            }
          }}
        />
        {error ? <FormHelperText>Minimum value is {min}.</FormHelperText> : undefined}
      </FormControl>
    </BaseNumberField.Root>
  );
}

function isDecimalText(value: string) {
  return value === '' || /^(?:\d+\.?\d*|\.\d+)$/.test(value);
}
