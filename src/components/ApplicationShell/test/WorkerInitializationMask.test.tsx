import { render, screen } from '@testing-library/react';
import { createTheme } from '@mui/material/styles';
import { expect, it } from 'vitest';
import { WorkerInitializationMask } from '../WorkerInitializationMask';

it('renders the worker initialization status and progress indicator', () => {
  render(<WorkerInitializationMask theme={createTheme()} />);

  expect(screen.getByRole('status', { name: 'Worker initialization' })).toBeInTheDocument();
  expect(screen.getByText('Initializing...')).toBeInTheDocument();
  expect(screen.getByRole('progressbar', { name: 'Initialization progress' })).toBeInTheDocument();
});
