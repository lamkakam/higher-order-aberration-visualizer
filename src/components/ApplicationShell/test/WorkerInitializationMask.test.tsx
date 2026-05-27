import { render, screen } from '@testing-library/react';
import { createTheme } from '@mui/material/styles';
import { expect, it } from 'vitest';
import { WorkerInitializationMask } from '../WorkerInitializationMask';

it('renders the worker initialization status and progress indicator', () => {
  render(
    <WorkerInitializationMask
      diagnostics={{
        status: 'initializing',
        message: 'Loading Python packages',
        progressPercent: 45
      }}
      theme={createTheme()}
    />
  );

  expect(screen.getByRole('status', { name: 'Worker initialization' })).toBeInTheDocument();
  expect(screen.getByText('Initializing...')).toBeInTheDocument();
  expect(screen.getByText('Loading Python packages')).toBeInTheDocument();
  expect(screen.getByText('45%')).toBeInTheDocument();
  expect(screen.getByRole('progressbar', { name: 'Initialization progress' })).toHaveAttribute(
    'aria-valuenow',
    '45'
  );
});

it('clamps progress percentage text and progressbar value', () => {
  render(
    <WorkerInitializationMask
      diagnostics={{
        status: 'initializing',
        message: 'Finishing startup',
        progressPercent: 125
      }}
      theme={createTheme()}
    />
  );

  expect(screen.getByText('100%')).toBeInTheDocument();
  expect(screen.getByRole('progressbar', { name: 'Initialization progress' })).toHaveAttribute(
    'aria-valuenow',
    '100'
  );
});
