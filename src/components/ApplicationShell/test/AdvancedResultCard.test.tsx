import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { AdvancedResultCard } from '../AdvancedResultCard';

const imageUrl = 'data:image/png;base64,preview';

it('renders advanced result previews with one shared descriptions accordion', () => {
  render(
    <AdvancedResultCard
      panels={[
        {
          id: 'simulated-image',
          imageUrl,
          statusText: 'Ready',
          isLoading: false,
          error: undefined,
          description: 'Simulated image description'
        },
        {
          id: 'psf',
          imageUrl,
          statusText: 'Ready',
          isLoading: false,
          error: undefined,
          title: 'PSF',
          description: 'PSF description',
          supplementalDescription: 'PSF supplemental note'
        }
      ]}
      sharedAboveAccordionContent={<div>Shared controls</div>}
    />
  );

  expect(screen.getByText('Shared controls')).toBeInTheDocument();

  const descriptionsButton = screen.getByRole('button', { name: 'Image Descriptions' });
  expect(descriptionsButton).toHaveAttribute('aria-expanded', 'true');
  expect(within(descriptionsButton).queryByText('Simulated Image')).not.toBeInTheDocument();
  expect(within(descriptionsButton).queryByText('PSF')).not.toBeInTheDocument();

  expect(screen.getByRole('group', { name: 'Simulated Image description' })).toHaveTextContent(
    'Simulated image description'
  );
  expect(screen.getByRole('group', { name: 'PSF description' })).toHaveTextContent(
    'PSF supplemental note'
  );
  expect(screen.getByText('Click the image to view it enlarged.')).toBeInTheDocument();
});
