import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { WavefrontLegendUnitControl } from '../WavefrontLegendUnitControl';

it('renders unit buttons and reports unit changes', async () => {
  const user = userEvent.setup();
  const handleChange = vi.fn();

  render(
    <WavefrontLegendUnitControl
      wavefrontLegendUnit="wave"
      onWavefrontLegendUnitChange={handleChange}
    />
  );

  expect(screen.getByText('Legend Unit')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Wave' })).toHaveClass('MuiButton-contained');
  expect(screen.getByRole('button', { name: 'Micron' })).toHaveClass('MuiButton-outlined');

  await user.click(screen.getByRole('button', { name: 'Micron' }));

  expect(handleChange).toHaveBeenCalledWith('micron');
});
