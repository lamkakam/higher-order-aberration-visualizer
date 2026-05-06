import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NumberField } from './NumberField';

describe('NumberField', () => {
  it('renders the initial committed value', () => {
    render(<NumberField label="Aperture" value={3} min={0.5} onChange={vi.fn()} />);

    expect(screen.getByLabelText('Aperture')).toHaveValue('3');
  });

  it('commits valid input changes', () => {
    const onChange = vi.fn();
    render(<NumberField label="Aperture" value={3} min={0.5} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Aperture'), {
      target: { value: '4.2' }
    });

    expect(onChange).toHaveBeenCalledWith(4.2);
  });

  it('commits leading-dot decimal input changes', () => {
    const onChange = vi.fn();
    render(<NumberField label="Aperture" value={3} min={0.5} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Aperture'), {
      target: { value: '.5' }
    });

    expect(onChange).toHaveBeenCalledWith(0.5);
  });

  it('keeps focus after committing a change that rerenders the parent', () => {
    function StatefulNumberField() {
      const [value, setValue] = useState(3);

      return <NumberField label="Aperture" value={value} min={0.5} onChange={setValue} />;
    }

    render(<StatefulNumberField />);
    const input = screen.getByLabelText('Aperture');

    act(() => {
      input.focus();
    });
    fireEvent.change(input, {
      target: { value: '4' }
    });

    expect(input).toHaveFocus();
    expect(input).toHaveValue('4');
  });

  it.each(['1e2', 'abc', '+1', '-1'])(
    'rejects %s without committing or displaying it',
    (invalidValue) => {
      const onChange = vi.fn();
      render(<NumberField label="Aperture" value={3} min={0.5} onChange={onChange} />);

      fireEvent.change(screen.getByLabelText('Aperture'), {
        target: { value: invalidValue }
      });

      expect(screen.getByLabelText('Aperture')).toHaveValue('3');
      expect(onChange).not.toHaveBeenCalled();
    }
  );

  it('allows an empty draft without committing', () => {
    const onChange = vi.fn();
    render(<NumberField label="Aperture" value={3} min={0.5} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Aperture'), {
      target: { value: '' }
    });

    expect(screen.getByLabelText('Aperture')).toHaveValue('');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps too-small draft text visible without committing', () => {
    const onChange = vi.fn();
    render(<NumberField label="Aperture" value={3} min={0.5} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Aperture'), {
      target: { value: '0.4' }
    });

    expect(screen.getByLabelText('Aperture')).toHaveValue('0.4');
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

    expect(screen.getByLabelText('Aperture')).toHaveValue('4');
  });
});
