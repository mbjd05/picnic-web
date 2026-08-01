import { describe, expect, it } from "vitest";

import { isWheelQuantityAdjustmentEvent } from "@/lib/cart/wheel-quantity-adjust";

describe("wheel quantity adjustment", () => {
  it("accepts line-mode mouse wheel events", () => {
    expect(
      isWheelQuantityAdjustmentEvent({
        ctrlKey: false,
        deltaMode: 1,
        deltaX: 0,
        deltaY: 3,
      })
    ).toBe(true);
  });

  it("accepts large vertical pixel-mode mouse wheel events", () => {
    expect(
      isWheelQuantityAdjustmentEvent({
        ctrlKey: false,
        deltaMode: 0,
        deltaX: 0,
        deltaY: 100,
      })
    ).toBe(true);
  });

  it("ignores small pixel-mode touchpad scroll events", () => {
    expect(
      isWheelQuantityAdjustmentEvent({
        ctrlKey: false,
        deltaMode: 0,
        deltaX: 0,
        deltaY: 8,
      })
    ).toBe(false);
  });

  it("ignores horizontal and zoom gestures", () => {
    expect(
      isWheelQuantityAdjustmentEvent({
        ctrlKey: false,
        deltaMode: 0,
        deltaX: 30,
        deltaY: 20,
      })
    ).toBe(false);
    expect(
      isWheelQuantityAdjustmentEvent({
        ctrlKey: true,
        deltaMode: 0,
        deltaX: 0,
        deltaY: 100,
      })
    ).toBe(false);
  });
});
