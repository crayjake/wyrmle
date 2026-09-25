/** An explicit zero is a finite puzzle with no replacement letters. */
export function validateRefillLimit(value: unknown): number | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 96) {
    throw new Error('Refill limit must be an integer between 0 and 96.')
  }
  return value
}
