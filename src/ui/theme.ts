/**
 * Theme preference resolution (Stage 5 item 3). The theme is a UI preference,
 * not solver state, so it lives in localStorage directly (no store field, no
 * zustand persist) and is applied as `data-theme` on the document element. This
 * module is the pure resolution seam: given the stored choice and the OS media
 * preference, decide the initial theme. Table-tested.
 */

export type Theme = "light" | "dark";

/**
 * The initial theme: an explicit stored choice wins; otherwise fall back to the
 * OS media preference (mediaDark). `stored` is whatever came out of
 * localStorage.getItem("theme") — a valid theme, or null/garbage, both of which
 * defer to the media query.
 */
export function resolveInitialTheme(
  stored: string | null,
  mediaDark: boolean,
): Theme {
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  return mediaDark ? "dark" : "light";
}
