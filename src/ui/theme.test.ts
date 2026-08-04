import { describe, it, expect } from "vitest";
import { resolveInitialTheme } from "./theme.ts";
import type { Theme } from "./theme.ts";

describe("resolveInitialTheme", () => {
  // (stored, mediaDark) → expected. An explicit stored choice wins; anything
  // else (null / garbage) defers to the OS media preference.
  const cases: [string | null, boolean, Theme][] = [
    ["dark", false, "dark"], // explicit dark overrides a light OS
    ["light", true, "light"], // explicit light overrides a dark OS
    ["dark", true, "dark"],
    ["light", false, "light"],
    [null, true, "dark"], // no choice → follow the media query
    [null, false, "light"],
    ["garbage", true, "dark"], // unrecognized stored value → media query
    ["garbage", false, "light"],
    ["", true, "dark"], // empty string is not a valid choice
  ];

  for (const [stored, mediaDark, expected] of cases) {
    it(`stored=${JSON.stringify(stored)} mediaDark=${mediaDark} → ${expected}`, () => {
      expect(resolveInitialTheme(stored, mediaDark)).toBe(expected);
    });
  }
});
