export function yearsToSeconds(years?: number) {
  return (years || 1) * 365 * 24 * 60 * 60
}

/**
 * Parses a string of years and returns a string of seconds
 * @param duration string of years to register for e.g. '1 year'
 * @returns string of seconds to register for e.g. '31556952'
 */
export const parseDuration = (duration: string) => {
  const [yearsStr] = duration.split(' ')
  const years = parseFloat(yearsStr)
  const seconds = yearsToSeconds(years)
  return seconds.toString()
}

/**
 * Parses a name and returns a string of the name without the .eth suffix
 * @param name ENS name with or without .eth suffix e.g. 'wagmi.eth' or 'wagmi'
 * @returns string of name without .eth suffix e.g. 'wagmi'
 */
export const parseName = (name: string): string => {
  return name.endsWith('.eth') ? name.split('.eth')[0] : name
}
