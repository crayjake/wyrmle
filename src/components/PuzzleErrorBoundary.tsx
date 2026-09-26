import { Component } from 'react'
import type { ReactNode } from 'react'

/** A stale downloaded chunk or failed render must leave a usable way back. */
export default class PuzzleErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return <main className="container">
      <h2>Could not open this puzzle</h2>
      <p>Your saved progress is still on this device.</p>
      <button className="daily-button" onClick={() => window.location.reload()}>Try again</button>
      <a className="daily-button" href="?preview=bingos">Choose a beta puzzle</a>
      <a className="daily-button" href={import.meta.env.BASE_URL}>Back to daily</a>
    </main>
  }
}
