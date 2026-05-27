import Slider, { type SliderProps } from '@mui/material/Slider';
import type { PointerEvent, TouchEvent } from 'react';

const touchSafeSliderThumbAttribute = 'data-touch-safe-slider-thumb';
const touchSafeSliderThumbSelector = `[${touchSafeSliderThumbAttribute}="true"]`;
const touchSafeSliderThumbProps = {
  [touchSafeSliderThumbAttribute]: 'true'
} as const;

type SliderSlotProps = NonNullable<SliderProps['slotProps']>;
type SliderThumbSlotProps = SliderSlotProps['thumb'];

function isInsideTouchSafeThumb(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(touchSafeSliderThumbSelector));
}

function cancelTouchSliderPointerStart(event: PointerEvent) {
  event.preventDefault();
  event.stopPropagation();
  event.nativeEvent.stopImmediatePropagation();
}

function stopTouchSliderTouchStart(event: TouchEvent) {
  event.stopPropagation();
  event.nativeEvent.stopImmediatePropagation();
}

function withTouchSafeThumbSlotProps(thumbSlotProps: SliderThumbSlotProps | undefined) {
  if (typeof thumbSlotProps === 'function') {
    return ((ownerState) => ({
      ...thumbSlotProps(ownerState),
      ...touchSafeSliderThumbProps
    })) satisfies SliderThumbSlotProps;
  }

  return {
    ...thumbSlotProps,
    ...touchSafeSliderThumbProps
  } satisfies SliderThumbSlotProps;
}

export function TouchSafeSlider({
  slotProps,
  onPointerDownCapture,
  onTouchStartCapture,
  ...props
}: SliderProps) {
  return (
    <Slider
      {...props}
      slotProps={{
        ...slotProps,
        thumb: withTouchSafeThumbSlotProps(slotProps?.thumb)
      }}
      onPointerDownCapture={(event) => {
        onPointerDownCapture?.(event);

        if (
          event.pointerType === 'touch' &&
          !event.defaultPrevented &&
          !isInsideTouchSafeThumb(event.target)
        ) {
          cancelTouchSliderPointerStart(event);
        }
      }}
      onTouchStartCapture={(event) => {
        onTouchStartCapture?.(event);

        if (!event.defaultPrevented && !isInsideTouchSafeThumb(event.target)) {
          stopTouchSliderTouchStart(event);
        }
      }}
    />
  );
}
