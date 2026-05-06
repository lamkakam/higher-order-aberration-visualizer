import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NumberField } from './NumberField';

describe('NumberField', () => {
  it('renders the initial committed value', () => {
    render(<NumberField label="Aperture" value={3} min={0.5} onChange={vi.fn()} />);

    expect(screen.getByLabelText('Aperture')).toHaveValue(3);
  });

  it('commits valid input changes', () => {
    const onChange = vi.fn();
    render(<NumberField label="Aperture" value={3} min={0.5} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Aperture'), {
      target: { value: '4' }
    });

    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('keeps too-small draft text visible without committing', () => {
    const onChange = vi.fn();
    render(<NumberField label="Aperture" value={3} min={0.5} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Aperture'), {
      target: { value: '0.4' }
    });

    expect(screen.getByLabelText('Aperture')).toHaveValue(0.4);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('resets draft text when the committed value changes', () => {
    const { rerender } = render(
      <NumberField label="Aperture" value={3} min={0.5} onChange={vi.fn()} />
    );

    fireEvent.change(screen.getByLabelText('Aperture'), {
      target: { value: '0.4' }
    });
    rerender(<NumberField label="Aperture" value={4} min={0.5} onChange={vi.fn()} />);

    expect(screen.getByLabelText('Aperture')).toHaveValue(4);
  });
});
