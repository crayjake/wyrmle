type ShareTarget = {
  share?: (data: { text: string }) => Promise<void>
  clipboard?: { writeText: (text: string) => Promise<void> }
}

export type ShareResultStatus = 'shared' | 'copied' | 'cancelled' | 'manual'

/** Call directly from the click handler: iOS sharing needs user activation. */
export async function shareResult(text: string, target: ShareTarget): Promise<ShareResultStatus> {
  if (typeof target.share === 'function') {
    try {
      // The URL is already in the text. Sending a second URL/title can duplicate
      // the link or lose the result text in some share destinations.
      await target.share({ text })
      return 'shared'
    } catch (error) {
      if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') return 'cancelled'
    }
  }
  try {
    if (!target.clipboard?.writeText) return 'manual'
    await target.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'manual'
  }
}
