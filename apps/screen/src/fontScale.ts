// Text size of the projected screen, set by the host to suit the room.
// Every font size in styles.css is in rem, so scaling the root font size scales all text.
// Per-viewer convenience only: storage may be unavailable (private mode…).

const KEY = 'jdlt.screen.fontScale';
export const FONT_SCALE_MIN = 0.7;
export const FONT_SCALE_MAX = 1.5;
export const FONT_SCALE_STEP = 0.1;

function clamp(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, rounded));
}

export function readFontScale() {
  try {
    const value = Number(localStorage.getItem(KEY));
    return value ? clamp(value) : 1;
  } catch {
    return 1;
  }
}

/** Applies the scale to the page and remembers it; returns the clamped value. */
export function applyFontScale(value: number) {
  const scale = clamp(value);
  document.documentElement.style.fontSize = `${scale * 100}%`;
  try {
    localStorage.setItem(KEY, String(scale));
  } catch {
    // ignore
  }
  return scale;
}
