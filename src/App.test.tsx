import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { createMockWorkerClient } from './test/workerMock';

it('renders worker status', async () => {
  render(<App workerClient={createMockWorkerClient()} />);

  expect(await screen.findByTestId('worker-status')).toHaveTextContent('ready');
  expect(screen.getByText('Mock worker ready')).toBeInTheDocument();
});

it('uses a mocked worker client for placeholder compute', async () => {
  const user = userEvent.setup();

  render(<App workerClient={createMockWorkerClient()} />);
  await user.click(screen.getByRole('button', { name: 'Compute' }));

  expect(await screen.findByTestId('compute-status')).toHaveTextContent(
    'Computed 16 by 16 placeholder grid'
  );
  expect(screen.getByTestId('compute-shape')).toHaveTextContent('256 Float32 samples');
});
