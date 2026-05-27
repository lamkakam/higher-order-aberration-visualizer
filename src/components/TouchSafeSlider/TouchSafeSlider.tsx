import Slider, { type SliderProps } from '@mui/material/Slider';
import type { PointerEvent, TouchEvent } from 'react';

const touchSafeSliderThumbAttribute = 'data-touch-safe-slider-thumb';
const touchSafeSliderThumbSelector = `[${touchSafeSliderThumbAttribute}="true"]`;
const touchSafeSliderThumbProps = {
  [touchSafeSliderThumbAttribute]: 'true'
} as const;

type SliderSlotProps = NonNullable<SliderProps['slotProps']>;
type SliderThumbSlotProps = SliderSlotProps['thumb'];
type SliderSx = SliderProps['sx'];

function isInsideTouchSafeThumb(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(touchSafeSliderThumbSelector));
}

function stopTouchSliderPointerStart(event: PointerEvent) {
  event.stopPropagation();
  event.nativeEvent.stopImmediatePropagation();
}

function stopTouchSliderTouchStart(event: TouchEvent) {
  event.stopPropagation();
  event.nativeEvent.stopImmediatePropagation();
}

function mergeSx(...sxValues: (SliderSx | undefined)[]): SliderSx {
  const mergedSx = sxValues.flatMap((sx) => {
    if (sx === undefined) {
      return [];
    }

    return Array.isArray(sx) ? sx : [sx];
  });

  return mergedSx.length === 1 ? mergedSx[0] : mergedSx;
}

function withTouchSafeThumbSlotProps(thumbSlotProps: SliderThumbSlotProps | undefined) {
  if (typeof thumbSlotProps === 'function') {
    return ((ownerState) => {
      const resolvedThumbSlotProps = thumbSlotProps(ownerState);

      return {
        ...resolvedThumbSlotProps,
        ...touchSafeSliderThumbProps,
        sx: mergeSx(resolvedThumbSlotProps.sx, { touchAction: 'none' })
      };
    }) satisfies SliderThumbSlotProps;
  }

  return {
    ...thumbSlotProps,
    ...touchSafeSliderThumbProps,
    sx: mergeSx(thumbSlotProps?.sx, { touchAction: 'none' })
  } satisfies SliderThumbSlotProps;
}

export function TouchSafeSlider({
  slotProps,
  onPointerDownCapture,
  onTouchStartCapture,
  sx,
  ...props
}: SliderProps) {
  return (
    <Slider
      {...props}
      sx={mergeSx(sx, { touchAction: 'pan-y' })}
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
          stopTouchSliderPointerStart(event);
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
