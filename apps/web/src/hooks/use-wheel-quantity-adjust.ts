import { type RefCallback, useCallback, useEffect, useRef } from "react";

import { isWheelQuantityAdjustmentEvent } from "@/lib/cart/wheel-quantity-adjust";

const WHEEL_ADJUST_COOLDOWN_MS = 120;
const WHEEL_ADJUST_POINTER_INTENT_MS = 1200;

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
  const lastPointerIntentAtRef = useRef(Number.NEGATIVE_INFINITY);
  const elementRef = useRef<HTMLElement | null>(null);
  const optionsRef = useRef({ canIncrement, canDecrement, onIncrement, onDecrement });

  useEffect(() => {
    optionsRef.current = { canIncrement, canDecrement, onIncrement, onDecrement };
  }, [canDecrement, canIncrement, onDecrement, onIncrement]);

  const handlePointerMove = useCallback((event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    if (event.movementX === 0 && event.movementY === 0) return;

    lastPointerIntentAtRef.current = performance.now();
  }, []);

  const handlePointerLeave = useCallback(() => {
    lastPointerIntentAtRef.current = Number.NEGATIVE_INFINITY;
  }, []);

  const handleWheel = useCallback((event: WheelEvent) => {
    if (!isWheelQuantityAdjustmentEvent(event)) return;

    const now = performance.now();
    if (now - lastPointerIntentAtRef.current > WHEEL_ADJUST_POINTER_INTENT_MS) return;

    const { canIncrement, canDecrement, onIncrement, onDecrement } = optionsRef.current;
    const canAdjust = event.deltaY < 0 ? canIncrement : canDecrement;
    if (!canAdjust) return;

    event.preventDefault();
    event.stopPropagation();

    if (now - lastAdjustmentAtRef.current < WHEEL_ADJUST_COOLDOWN_MS) return;

    lastAdjustmentAtRef.current = now;
    lastPointerIntentAtRef.current = now;

    if (event.deltaY < 0) {
      onIncrement();
    } else {
      onDecrement();
    }
  }, []);

  useEffect(
    () => () => {
      elementRef.current?.removeEventListener("pointermove", handlePointerMove);
      elementRef.current?.removeEventListener("pointerleave", handlePointerLeave);
      elementRef.current?.removeEventListener("wheel", handleWheel);
      elementRef.current = null;
    },
    [handlePointerLeave, handlePointerMove, handleWheel]
  );

  return useCallback(
    (element: HTMLElement | null) => {
      elementRef.current?.removeEventListener("pointermove", handlePointerMove);
      elementRef.current?.removeEventListener("pointerleave", handlePointerLeave);
      elementRef.current?.removeEventListener("wheel", handleWheel);

      elementRef.current = element;
      element?.addEventListener("pointermove", handlePointerMove);
      element?.addEventListener("pointerleave", handlePointerLeave);
      element?.addEventListener("wheel", handleWheel, { passive: false });
    },
    [handlePointerLeave, handlePointerMove, handleWheel]
  );
}
