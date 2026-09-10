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
