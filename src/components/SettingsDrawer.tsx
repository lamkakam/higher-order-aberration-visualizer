import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Drawer from '@mui/material/Drawer';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

export type ThemeMode = 'light' | 'system' | 'dark';
export type DisplayMode = 'basic' | 'advanced';

interface SettingsDrawerProps {
  readonly open: boolean;
  readonly mode: ThemeMode;
  readonly displayMode: DisplayMode;
  readonly showScaleBar: boolean;
  readonly onClose: () => void;
  readonly onModeChange: (mode: ThemeMode) => void;
  readonly onDisplayModeChange: (mode: DisplayMode) => void;
  readonly onShowScaleBarChange: (showScaleBar: boolean) => void;
}

const modeOptions = [
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
  { value: 'dark', label: 'Dark' }
] as const;

const displayModeOptions = [
  { value: 'basic', label: 'Basic' },
  { value: 'advanced', label: 'Advanced' }
] as const;

export function SettingsDrawer({
  open,
  mode,
  displayMode,
  showScaleBar,
  onClose,
  onModeChange,
  onDisplayModeChange,
  onShowScaleBarChange
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
        <Typography id="display-mode-button-group-label" variant="subtitle2" sx={{ mb: 1, mt: 3 }}>
          Display
        </Typography>
        <ButtonGroup aria-labelledby="display-mode-button-group-label" fullWidth>
          {displayModeOptions.map((option) => (
            <Button
              key={option.value}
              aria-label={option.label}
              variant={displayMode === option.value ? 'contained' : 'outlined'}
              onClick={() => {
                onDisplayModeChange(option.value);
              }}
            >
              {option.label}
            </Button>
          ))}
        </ButtonGroup>
        <FormControlLabel
          sx={{ mt: 3 }}
          control={
            <Switch
              checked={showScaleBar}
              onChange={(event) => {
                onShowScaleBarChange(event.target.checked);
              }}
              slotProps={{ input: { 'aria-label': 'Show scale bar' } }}
            />
          }
          label="Show scale bar"
        />
      </Box>
    </Drawer>
  );
}
