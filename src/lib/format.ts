/**
 * Admin-entered service/package names are sometimes typed in ALL CAPS
 * (e.g. "MINI DETAIL") while most are entered in normal title case (e.g.
 * "Interior Detail") — shown side by side that reads as inconsistent.
 * Only re-cases a name that's entirely uppercase, so intentional acronyms
 * inside otherwise-mixed-case names (e.g. "XL Wash") are left untouched.
 */
export function normalizeTitleCase(name: string): string {
  if (name !== name.toUpperCase() || name === name.toLowerCase()) return name;
  return name
    .toLowerCase()
    .replace(/(^|\s)([a-z])/g, (_, boundary, letter) => boundary + letter.toUpperCase());
}

/**
 * Which package carries the "Most Popular" badge: Superior Wash when it is in
 * the list, otherwise the middle one as before.
 */
export function mostPopularIndex(names: string[]): number {
  if (names.length < 2) return -1;
  const superior = names.findIndex((n) => n.trim().toLowerCase() === "superior wash");
  return superior >= 0 ? superior : Math.floor((names.length - 1) / 2);
}
