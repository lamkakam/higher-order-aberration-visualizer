import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { createDefaultZernikeCoefficientsByWavelength } from '../lib/defaults';
import { ApproximateStrehlSummary } from '../ApproximateStrehlSummary';

it('renders the monochromatic Strehl summary', () => {
  render(
    <ApproximateStrehlSummary
      isPolychromatic={false}
      shouldWrapPolychromaticStrehl={false}
      simulationWavelengths={[550]}
      zernikeCoefficientsByWavelength={createDefaultZernikeCoefficientsByWavelength()}
    />
  );

  expect(screen.getByText('Approx. Strehl Ratio: 100.0%')).toBeInTheDocument();
});

it('renders a Strehl value for each polychromatic wavelength', () => {
  render(
    <ApproximateStrehlSummary
      isPolychromatic
      shouldWrapPolychromaticStrehl={false}
      simulationWavelengths={[550, 656, 486]}
      zernikeCoefficientsByWavelength={createDefaultZernikeCoefficientsByWavelength()}
    />
  );

  expect(screen.getByText('Approx. Strehl Ratio:')).toBeInTheDocument();
  expect(screen.getByText(/550\s+nm:\s+100\.0%/)).toBeInTheDocument();
  expect(screen.getByText(/656\s+nm:\s+100\.0%/)).toBeInTheDocument();
  expect(screen.getByText(/486\s+nm:\s+100\.0%/)).toBeInTheDocument();
});
