/**
 * Categorical palette for multi-slice charts (bookings by service, etc).
 * Validated order (dataviz skill default): passes lightness band, chroma
 * floor, and CVD/normal-vision separation on adjacent pairs. Fold a 9th
 * series into "Other" rather than generating a new hue.
 */
export const CATEGORICAL_COLORS = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
];

/** Chart chrome — hairline grid/axis tokens, one shade off the white card surface. */
export const CHART_CHROME = {
  grid: "#e1e0d9",
  axis: "#c3c2b7",
  axisText: "#898781",
} as const;
