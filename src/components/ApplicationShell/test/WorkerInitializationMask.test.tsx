import { render, screen } from '@testing-library/react';
import { createTheme } from '@mui/material/styles';
import { expect, it } from 'vitest';
import i18n from '../../../i18n';
import { WorkerInitializationMask } from '../WorkerInitializationMask';

it('renders the worker initialization status and progress indicator', () => {
  render(
    <WorkerInitializationMask
      diagnostics={{
        status: 'initializing',
        message: 'Loading Python packages',
        messageKey: 'status.worker.loadingPythonPackages',
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

it('falls back to the literal worker message when no translation key exists', () => {
  render(
    <WorkerInitializationMask
      diagnostics={{
        status: 'error',
        message: 'Pyodide failed with code 42',
        progressPercent: 20
      }}
      theme={createTheme()}
    />
  );

  expect(screen.getByText('Pyodide failed with code 42')).toBeInTheDocument();
});

it('falls back to the literal worker message when a translation key is missing', () => {
  const translation = i18n.getResourceBundle('en', 'translation') as {
    status?: {
      worker?: Record<string, string | undefined>;
    };
  };
  const workerTranslations = translation.status?.worker;
  const previousTranslation = workerTranslations?.loadingBundledSources;

  if (workerTranslations !== undefined) {
    delete workerTranslations.loadingBundledSources;
  }

  try {
    render(
      <WorkerInitializationMask
        diagnostics={{
          status: 'initializing',
          message: 'Readable fallback',
          messageKey: 'status.worker.loadingBundledSources',
          progressPercent: 65
        }}
        theme={createTheme()}
      />
    );

    expect(screen.getByText('Readable fallback')).toBeInTheDocument();
    expect(screen.queryByText('status.worker.loadingBundledSources')).not.toBeInTheDocument();
  } finally {
    if (previousTranslation !== undefined) {
      i18n.addResource(
        'en',
        'translation',
        'status.worker.loadingBundledSources',
        previousTranslation
      );
    }
  }
});
