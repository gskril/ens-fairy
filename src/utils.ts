export function yearsToSeconds(years?: number) {
  return (years || 1) * 365 * 24 * 60 * 60
}
