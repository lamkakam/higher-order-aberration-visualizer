import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NumberField } from '../NumberField';

afterEach(() => {
  vi.useRealTimers();
});

describe('NumberField', () => {
  it('renders the initial committed value', () => {
    render(<NumberField label="Aperture" value={3} min={0.5} onChange={vi.fn()} />);

    expect(screen.getByLabelText('Aperture')).toHaveValue('3');
  });

  it('forwards autocomplete when provided', () => {
    render(
      <NumberField label="Aperture" value={3} min={0.5} autoComplete="off" onChange={vi.fn()} />
    );

    expect(screen.getByLabelText('Aperture')).toHaveAttribute('autocomplete', 'off');
  });

  it('can use an external label without rendering an embedded label', () => {
    render(
      <>
        <label htmlFor="aperture-input">Aperture</label>
        <NumberField
          id="aperture-input"
          label="Aperture"
          labelMode="external"
          value={3}
          min={0.5}
          onChange={vi.fn()}
        />
      </>
    );

    expect(screen.getByText('Aperture', { selector: 'label' })).toHaveAttribute(
      'for',
      'aperture-input'
    );
    expect(screen.getByLabelText('Aperture')).toHaveValue('3');
    expect(document.querySelector('.MuiInputLabel-root')).not.toBeInTheDocument();
  });

  it('updates draft text immediately without committing after timers advance', async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<NumberField label="Aperture" value={3} min={0.5} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Aperture'), {
      target: { value: '4.2' }
    });

    expect(screen.getByLabelText('Aperture')).toHaveValue('4.2');
    expect(onChange).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('commits leading-dot decimal input changes on blur', () => {
    const onChange = vi.fn();
    render(<NumberField label="Aperture" value={3} min={0.5} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Aperture'), {
      target: { value: '.5' }
    });
    fireEvent.blur(screen.getByLabelText('Aperture'));

    expect(onChange).toHaveBeenCalledWith(0.5);
  });

  it('flushes valid input changes on blur', () => {
    const onChange = vi.fn();
    render(<NumberField label="Aperture" value={3} min={0.5} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Aperture'), {
      target: { value: '4.2' }
    });
    fireEvent.blur(screen.getByLabelText('Aperture'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(4.2);
  });

  it('flushes valid input changes on Enter', () => {
    const onChange = vi.fn();
    render(<NumberField label="Aperture" value={3} min={0.5} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Aperture'), {
      target: { value: '4.2' }
    });
    fireEvent.keyDown(screen.getByLabelText('Aperture'), { key: 'Enter' });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(4.2);
  });

  it('keeps focus after Enter commits a draft change and rerenders the parent', () => {
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

    fireEvent.keyDown(input, { key: 'Enter' });

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

  it('does not commit too-small drafts after timers advance', async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<NumberField label="Aperture" value={3} min={0.5} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Aperture'), {
      target: { value: '0.4' }
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
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

  it('replaces an uncommitted draft when the committed value changes', async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { rerender } = render(
      <NumberField label="Aperture" value={3} min={0.5} onChange={onChange} />
    );

    fireEvent.change(screen.getByLabelText('Aperture'), {
      target: { value: '4.2' }
    });
    rerender(<NumberField label="Aperture" value={5} min={0.5} onChange={onChange} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(screen.getByLabelText('Aperture')).toHaveValue('5');
    expect(onChange).not.toHaveBeenCalled();
  });
});
