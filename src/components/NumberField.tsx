import { NumberField as BaseNumberField } from '@base-ui/react/number-field';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import OutlinedInput from '@mui/material/OutlinedInput';
import { useId, useState } from 'react';

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
      key={value}
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
  const [draftValue, setDraftValue] = useState(String(value));

  function handleInputChange(nextValue: string) {
    setDraftValue(nextValue);
    const parsedValue = Number(nextValue);
    if (Number.isFinite(parsedValue) && parsedValue >= min) {
      onChange(parsedValue);
    }
  }

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
          type="number"
          value={draftValue}
          inputProps={{ min, step: 0.1 }}
          onChange={(event) => {
            handleInputChange(event.target.value);
          }}
        />
        {error ? <FormHelperText>Minimum value is {min}.</FormHelperText> : undefined}
      </FormControl>
    </BaseNumberField.Root>
  );
}
