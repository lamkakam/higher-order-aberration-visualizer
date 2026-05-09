import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SimulatedImageCard } from './SimulatedImageCard';

const imageUrl = 'data:image/png;base64,preview';
const enlargementHint = 'Click the image to view it enlarged.';

describe('SimulatedImageCard', () => {
  it('opens the enlarged image when the preview image is clicked', async () => {
    const user = userEvent.setup();
    render(
      <SimulatedImageCard
        imageUrl={imageUrl}
        statusText="Ready"
        isLoading={false}
        error={undefined}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Open enlarged Simulated Image image' }));

    expect(screen.getByRole('dialog', { name: 'Simulated Image enlarged image' })).toBeInTheDocument();
    expect(screen.getAllByAltText('Convolved simulated target')).toHaveLength(2);
  });

  it('removes the enlarged image when rerendered with an error', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <SimulatedImageCard
        imageUrl={imageUrl}
        statusText="Ready"
        isLoading={false}
        error={undefined}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Open enlarged Simulated Image image' }));
    rerender(
      <SimulatedImageCard
        imageUrl={imageUrl}
        statusText="Ready"
        isLoading={false}
        error="Simulation failed"
      />
    );

    expect(screen.queryByRole('dialog', { name: 'Simulated Image enlarged image' })).not.toBeInTheDocument();
    expect(screen.getByText('Simulation failed')).toBeInTheDocument();
  });

  it('removes the enlarged image when rerendered without an image', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <SimulatedImageCard
        imageUrl={imageUrl}
        statusText="Ready"
        isLoading={false}
        error={undefined}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Open enlarged Simulated Image image' }));
    rerender(
      <SimulatedImageCard
        imageUrl={undefined}
        statusText="Waiting for image"
        isLoading={false}
        error={undefined}
      />
    );

    expect(screen.queryByRole('dialog', { name: 'Simulated Image enlarged image' })).not.toBeInTheDocument();
    expect(screen.getByText('Waiting for image')).toBeInTheDocument();
  });

  it('does not reopen automatically when the same image becomes available again', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <SimulatedImageCard
        imageUrl={imageUrl}
        statusText="Ready"
        isLoading={false}
        error={undefined}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Open enlarged Simulated Image image' }));
    rerender(
      <SimulatedImageCard
        imageUrl={imageUrl}
        statusText="Ready"
        isLoading={false}
        error="Simulation failed"
      />
    );
    rerender(
      <SimulatedImageCard
        imageUrl={imageUrl}
        statusText="Ready"
        isLoading={false}
        error={undefined}
      />
    );

    expect(screen.queryByRole('dialog', { name: 'Simulated Image enlarged image' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open enlarged Simulated Image image' })).toBeInTheDocument();
  });

  it('shows an enlargement hint when an image is available', () => {
    render(
      <SimulatedImageCard
        imageUrl={imageUrl}
        statusText="Ready"
        isLoading={false}
        error={undefined}
      />
    );

    expect(screen.getByText(enlargementHint)).toBeInTheDocument();
  });

  it('does not show an enlargement hint without an image', () => {
    render(
      <SimulatedImageCard
        imageUrl={undefined}
        statusText="Waiting for image"
        isLoading={false}
        error={undefined}
      />
    );

    expect(screen.queryByText(enlargementHint)).not.toBeInTheDocument();
  });

  it('does not show an enlargement hint when an error is shown', () => {
    render(
      <SimulatedImageCard
        imageUrl={imageUrl}
        statusText="Ready"
        isLoading={false}
        error="Simulation failed"
      />
    );

    expect(screen.queryByText(enlargementHint)).not.toBeInTheDocument();
  });

  it('renders bottom content after the description', () => {
    render(
      <SimulatedImageCard
        imageUrl={undefined}
        statusText="Waiting for image"
        isLoading={false}
        error={undefined}
        description="Card description"
        bottomContent={<div>Bottom controls</div>}
      />
    );

    const description = screen.getByText('Card description');
    const bottomContent = screen.getByText('Bottom controls');

    expect(
      description.compareDocumentPosition(bottomContent) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('renders the enlargement hint between the description and bottom content', () => {
    render(
      <SimulatedImageCard
        imageUrl={imageUrl}
        statusText="Ready"
        isLoading={false}
        error={undefined}
        description="Card description"
        bottomContent={<div>Bottom controls</div>}
      />
    );

    const description = screen.getByText('Card description');
    const hint = screen.getByText(enlargementHint);
    const bottomContent = screen.getByText('Bottom controls');

    expect(description.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(hint.compareDocumentPosition(bottomContent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
