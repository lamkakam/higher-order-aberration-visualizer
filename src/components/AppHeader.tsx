import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';

interface AppHeaderProps {
  readonly onOpenSettings: () => void;
}

export function AppHeader({ onOpenSettings }: AppHeaderProps) {
  return (
    <AppBar position="static" color="default" elevation={0}>
      <Toolbar sx={{ gap: 2, justifyContent: 'space-between' }}>
        <Box>
          <Typography component="p" variant="h6">
            HOA Visualizer
          </Typography>
          <Typography component="p" variant="body2" color="text.secondary">
            Optical Aberration Simulator
          </Typography>
        </Box>
        <Button aria-label="Setting" variant="contained" onClick={onOpenSettings}>
          Setting
        </Button>
      </Toolbar>
    </AppBar>
  );
}
