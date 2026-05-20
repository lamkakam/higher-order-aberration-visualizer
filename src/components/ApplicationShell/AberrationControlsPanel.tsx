import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { useTranslation } from 'react-i18next';
import type { ZernikeCoefficientKey } from '../../workers/types';
import { AberrationSlidersCard } from '../AberrationSlidersCard';
import {
  spectralWavelengths,
  type SpectralWavelength,
  type ZernikeCoefficientMap,
  type ZernikeCoefficientsByWavelength
} from './defaults';

interface AberrationControlsPanelProps {
  readonly isPolychromatic: boolean;
  readonly selectedWavelength: SpectralWavelength;
  readonly syncWavelengthCoefficients: boolean;
  readonly zernikeCoefficients: ZernikeCoefficientMap;
  readonly zernikeCoefficientsByWavelength: ZernikeCoefficientsByWavelength;
  readonly onResetAllWavelengths: () => void;
  readonly onResetZernikeCoefficients: (wavelength: SpectralWavelength) => void;
  readonly onSelectedWavelengthChange: (wavelength: SpectralWavelength) => void;
  readonly onSyncWavelengthCoefficientsChange: (enabled: boolean) => void;
  readonly onZernikeCoefficientChange: (
    wavelength: SpectralWavelength,
    key: ZernikeCoefficientKey,
    value: number
  ) => void;
}

export function AberrationControlsPanel({
  isPolychromatic,
  selectedWavelength,
  syncWavelengthCoefficients,
  zernikeCoefficients,
  zernikeCoefficientsByWavelength,
  onResetAllWavelengths,
  onResetZernikeCoefficients,
  onSelectedWavelengthChange,
  onSyncWavelengthCoefficientsChange,
  onZernikeCoefficientChange
}: AberrationControlsPanelProps) {
  const { t } = useTranslation();

  if (!isPolychromatic) {
    return (
      <AberrationSlidersCard
        wavelengthNm={550}
        values={zernikeCoefficients}
        onValueChange={(key, value) => {
          onZernikeCoefficientChange(550, key, value);
        }}
        onReset={() => {
          onResetZernikeCoefficients(550);
        }}
      />
    );
  }

  return (
    <Stack spacing={2}>
      <Tabs
        aria-label={t('opticalSystem.polychromaticWavelength')}
        value={selectedWavelength}
        onChange={(_, nextWavelength: SpectralWavelength) => {
          onSelectedWavelengthChange(nextWavelength);
        }}
      >
        {spectralWavelengths.map((wavelength) => (
          <Tab key={wavelength} label={`${wavelength} nm`} value={wavelength} />
        ))}
      </Tabs>
      <AberrationSlidersCard
        wavelengthNm={selectedWavelength}
        values={zernikeCoefficientsByWavelength[selectedWavelength]}
        onValueChange={(key, value) => {
          onZernikeCoefficientChange(selectedWavelength, key, value);
        }}
        onReset={() => {
          onResetZernikeCoefficients(selectedWavelength);
        }}
        showWavelengthSyncControls
        syncWavelengthCoefficients={syncWavelengthCoefficients}
        onSyncWavelengthCoefficientsChange={onSyncWavelengthCoefficientsChange}
        onResetAllWavelengths={onResetAllWavelengths}
      />
    </Stack>
  );
}
