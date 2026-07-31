import { type RefCallback, useCallback, useEffect, useRef } from "react";

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
}): RefCallback<HTMLElement> {
  const lastAdjustmentAtRef = useRef(0);
  const elementRef = useRef<HTMLElement | null>(null);
  const optionsRef = useRef({ canIncrement, canDecrement, onIncrement, onDecrement });

  useEffect(() => {
    optionsRef.current = { canIncrement, canDecrement, onIncrement, onDecrement };
  }, [canDecrement, canIncrement, onDecrement, onIncrement]);

  const handleWheel = useCallback((event: WheelEvent) => {
    if (event.deltaY === 0) return;

    event.preventDefault();
    event.stopPropagation();
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

    const now = performance.now();
    if (now - lastAdjustmentAtRef.current < WHEEL_ADJUST_COOLDOWN_MS) return;

    const { canIncrement, canDecrement, onIncrement, onDecrement } = optionsRef.current;
    if (event.deltaY < 0 && canIncrement) {
      lastAdjustmentAtRef.current = now;
      onIncrement();
    } else if (event.deltaY > 0 && canDecrement) {
      lastAdjustmentAtRef.current = now;
      onDecrement();
    }
  }, []);

  useEffect(
    () => () => {
      elementRef.current?.removeEventListener("wheel", handleWheel);
      elementRef.current = null;
    },
    [handleWheel]
  );

  return useCallback(
    (element: HTMLElement | null) => {
      elementRef.current?.removeEventListener("wheel", handleWheel);
      elementRef.current = element;
      element?.addEventListener("wheel", handleWheel, { passive: false });
    },
    [handleWheel]
  );
}
