import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';

interface SimulatedImageCardProps {
  readonly imageUrl: string | undefined;
  readonly statusText: string;
  readonly isLoading: boolean;
  readonly error: string | undefined;
}

export function SimulatedImageCard({
  imageUrl,
  statusText,
  isLoading,
  error
}: SimulatedImageCardProps) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box
          sx={{
            alignItems: 'center',
            bgcolor: 'background.default',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            display: 'flex',
            height: '25vh',
            justifyContent: 'center',
            minHeight: 160,
            overflow: 'hidden'
          }}
        >
          {imageUrl && !error ? (
            <Box
              component="img"
              src={imageUrl}
              alt="Convolved simulated target"
              sx={{ height: '100%', objectFit: 'contain', width: '100%' }}
            />
          ) : (
            <Typography color={error ? 'error' : 'text.secondary'}>
              {error ?? (isLoading ? 'Preparing simulation' : statusText)}
            </Typography>
          )}
        </Box>
        <Typography variant="h5" component="h2">
          Simulated Image
        </Typography>
        <Typography variant="body2" color="text.secondary">
          The convolved target image updates automatically as aperture diameter,
          target, and Zernike aberration values change.
        </Typography>
      </CardContent>
    </Card>
  );
}
