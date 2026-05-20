import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import {
  approximateStrehlRatio,
  formatApproximateStrehlRatio
} from '../lib/simulationConfig';
import type {
  SpectralWavelength,
  ZernikeCoefficientsByWavelength
} from './lib/defaults';

interface ApproximateStrehlSummaryProps {
  readonly isPolychromatic: boolean;
  readonly shouldWrapPolychromaticStrehl: boolean;
  readonly simulationWavelengths: readonly SpectralWavelength[];
  readonly zernikeCoefficientsByWavelength: ZernikeCoefficientsByWavelength;
}

export function ApproximateStrehlSummary({
  isPolychromatic,
  shouldWrapPolychromaticStrehl,
  simulationWavelengths,
  zernikeCoefficientsByWavelength
}: ApproximateStrehlSummaryProps) {
  const { t } = useTranslation();

  return (
    <Stack
      direction="row"
      spacing={1}
      useFlexGap
      style={{
        flexWrap: shouldWrapPolychromaticStrehl ? 'wrap' : 'nowrap',
        overflowX: shouldWrapPolychromaticStrehl ? 'visible' : 'auto',
        whiteSpace: shouldWrapPolychromaticStrehl ? 'normal' : 'nowrap'
      }}
      sx={{
        alignItems: 'center',
        minWidth: 0
      }}
    >
      {isPolychromatic ? (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            {t('aberrations.approxStrehl')}
          </Typography>
          {simulationWavelengths.map((wavelength, index) => (
            <Fragment key={wavelength}>
              {index > 0 && !shouldWrapPolychromaticStrehl ? (
                <Divider flexItem orientation="vertical" />
              ) : undefined}
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                {wavelength} nm:{' '}
                {(
                  approximateStrehlRatio(zernikeCoefficientsByWavelength[wavelength]) * 100
                ).toFixed(1)}
                %
              </Typography>
            </Fragment>
          ))}
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          {formatApproximateStrehlRatio(zernikeCoefficientsByWavelength[550], t)}
        </Typography>
      )}
    </Stack>
  );
}
