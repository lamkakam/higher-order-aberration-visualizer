import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommitSlider } from '../CommitSlider';

afterEach(() => {
  vi.restoreAllMocks();
});

function renderCommitSlider(onCommit = vi.fn()) {
  render(
    <CommitSlider
      ariaLabel="Defocus"
      label="Defocus"
      min={-2}
      max={2}
      step={0.001}
      value={-1.234}
      roundValue={(value) => value}
      onCommit={onCommit}
      input={{
        formatValue: (value) => value.toFixed(3),
        parseDraft: (draft) => Number(draft),
        isDraftAllowed: () => true,
        isValidDraft: (_draft, parsedValue) => Number.isFinite(parsedValue)
      }}
    />
  );
}

function setNavigatorProperty<T extends keyof Navigator>(property: T, value: Navigator[T]) {
  Object.defineProperty(window.navigator, property, {
    configurable: true,
    value
  });
}

describe('CommitSlider', () => {
  it('keeps the textbox wide enough in compact flex rows', () => {
    renderCommitSlider();

    const input = screen.getByRole('textbox', { name: 'Defocus' });
    const textField = input.closest('.MuiFormControl-root');

    expect(input).toHaveStyle({ maxWidth: '3em', minWidth: '3em', width: '3em' });
    expect(textField).toHaveStyle({ flexShrink: '0' });
  });

  it('restores the focused scroll position after iOS Safari blur', () => {
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    setNavigatorProperty(
      'userAgent',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 ' +
        '(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
    );
    setNavigatorProperty('maxTouchPoints', 5);
    vi.spyOn(window, 'scrollX', 'get').mockReturnValue(12);
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(345);

    renderCommitSlider();

    const input = screen.getByRole('textbox', { name: 'Defocus' });
    fireEvent.focus(input);
    fireEvent.blur(input);

    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1);
    expect(scrollToSpy).toHaveBeenCalledWith(12, 345);
  });
});
