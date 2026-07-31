import { type WheelEvent, useCallback, useRef } from "react";

const WHEEL_ADJUST_COOLDOWN_MS = 120;

export function useWheelQuantityAdjust({
  canIncrement,
  canDecrement,
  onIncrement,
  onDecrement,
}: {
  canIncrement: boolean;
  canDecrement: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  const lastAdjustmentAtRef = useRef(0);

  return useCallback(
    (event: WheelEvent<HTMLElement>) => {
      if (event.deltaY === 0 || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

      event.preventDefault();
      event.stopPropagation();

      const now = performance.now();
      if (now - lastAdjustmentAtRef.current < WHEEL_ADJUST_COOLDOWN_MS) return;

      if (event.deltaY < 0 && canIncrement) {
        lastAdjustmentAtRef.current = now;
        onIncrement();
      } else if (event.deltaY > 0 && canDecrement) {
        lastAdjustmentAtRef.current = now;
        onDecrement();
      }
    },
    [canDecrement, canIncrement, onDecrement, onIncrement]
  );
}
