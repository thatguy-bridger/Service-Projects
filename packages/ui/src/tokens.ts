/**
 * TS mirror of tokens.css for use in JS logic (chart colors, canvas, etc).
 * Keep values in sync with tokens.css by hand — CSS is the source of truth
 * for anything styled directly in markup/classes.
 */
export const colors = {
  accent: {
    50: "#f2f0ff",
    100: "#e5e0ff",
    200: "#c9beff",
    300: "#a996ff",
    400: "#8b70fa",
    500: "#6f4ef0",
    600: "#5936d1",
    700: "#4527a8",
    800: "#331d7f",
    900: "#23145a",
  },
  gray: {
    0: "#ffffff",
    50: "#faf9f8",
    100: "#f2f0ee",
    200: "#e6e3e0",
    300: "#d3cec9",
    400: "#a9a29b",
    500: "#837b73",
    600: "#635c56",
    700: "#47423d",
    800: "#2e2a26",
    900: "#1c1916",
  },
  success: "#2fa66b",
  warning: "#d99a2b",
  danger: "#d9502b",
  info: "#2f8ed9",
} as const;

export const radius = {
  sm: "0.375rem",
  md: "0.625rem",
  lg: "1rem",
  full: "999px",
} as const;

export const space = {
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  8: "2rem",
  10: "2.5rem",
  12: "3rem",
  16: "4rem",
} as const;
