import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Drawer from '@mui/material/Drawer';
import Typography from '@mui/material/Typography';

export type ThemeMode = 'light' | 'system' | 'dark';

interface SettingsDrawerProps {
  readonly open: boolean;
  readonly mode: ThemeMode;
  readonly onClose: () => void;
  readonly onModeChange: (mode: ThemeMode) => void;
}

const modeOptions = [
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' }
] as const;

export function SettingsDrawer({
  open,
  mode,
  onClose,
  onModeChange
}: SettingsDrawerProps) {
  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: 280, p: 3 }}>
        <Typography id="mode-button-group-label" variant="subtitle2" sx={{ mb: 1 }}>
          Mode
        </Typography>
        <ButtonGroup aria-labelledby="mode-button-group-label" fullWidth>
          {modeOptions.map((option) => (
            <Button
              key={option.value}
              aria-label={option.label}
              variant={mode === option.value ? 'contained' : 'outlined'}
              onClick={() => {
                onModeChange(option.value);
              }}
            >
              {option.label}
            </Button>
          ))}
        </ButtonGroup>
      </Box>
    </Drawer>
  );
}
