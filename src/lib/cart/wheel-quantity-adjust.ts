const DOM_DELTA_PIXEL = 0;
const PIXEL_WHEEL_MIN_DELTA = 40;

export type WheelQuantityEvent = {
  ctrlKey: boolean;
  deltaMode: number;
  deltaX: number;
  deltaY: number;
};

export function isWheelQuantityAdjustmentEvent(event: WheelQuantityEvent): boolean {
  if (event.ctrlKey) return false;
  if (event.deltaY === 0) return false;
  if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return false;
  if (event.deltaMode !== DOM_DELTA_PIXEL) return true;

  return Math.abs(event.deltaX) <= 1 && Math.abs(event.deltaY) >= PIXEL_WHEEL_MIN_DELTA;
}
