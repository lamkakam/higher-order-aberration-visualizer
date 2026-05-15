import { NumberField as BaseNumberField } from '@base-ui/react/number-field';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import OutlinedInput from '@mui/material/OutlinedInput';
import { useCallback, useId, useState } from 'react';

interface NumberFieldProps {
  readonly id?: string;
  readonly label: string;
  readonly labelMode?: 'embedded' | 'external';
  readonly value: number;
  readonly min: number;
  readonly error?: boolean;
  readonly onChange: (value: number) => void;
}

export function NumberField({
  id: providedId,
  label,
  labelMode = 'embedded',
  value,
  min,
  error = false,
  onChange
}: NumberFieldProps) {
  const generatedId = useId();
  const id = providedId ?? generatedId;

  return (
    <NumberFieldInput
      id={id}
      label={label}
      labelMode={labelMode}
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
  labelMode = 'embedded',
  value,
  min,
  error = false,
  onChange
}: NumberFieldInputProps) {
  const [draftState, setDraftState] = useState({
    committedValue: value,
    draftValue: String(value)
  });
  let currentDraftState = draftState;

  if (currentDraftState.committedValue !== value) {
    currentDraftState = {
      committedValue: value,
      draftValue: String(value)
    };
    setDraftState(currentDraftState);
  }

  const commitDraft = useCallback(
    (nextDraft: string) => {
      const parsedValue = Number(nextDraft);
      if (
        nextDraft.trim() !== '' &&
        Number.isFinite(parsedValue) &&
        parsedValue >= min &&
        parsedValue !== value
      ) {
        onChange(parsedValue);
      }
    },
    [min, onChange, value]
  );

  const flushDraft = useCallback(() => {
    commitDraft(currentDraftState.draftValue);
  }, [commitDraft, currentDraftState.draftValue]);

  const handleInputChange = (nextValue: string) => {
    if (!isDecimalText(nextValue)) {
      return;
    }

    setDraftState({
      committedValue: value,
      draftValue: nextValue
    });
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
        {labelMode === 'embedded' ? <InputLabel htmlFor={id}>{label}</InputLabel> : undefined}
        <OutlinedInput
          id={id}
          label={labelMode === 'embedded' ? label : undefined}
          type="text"
          value={currentDraftState.draftValue}
          inputProps={{ inputMode: 'decimal', min, step: 0.1 }}
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
