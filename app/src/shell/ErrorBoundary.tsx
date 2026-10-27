import { Component, type ReactNode } from 'react'
import { Button } from '../ui/Button'
import { StateView } from '../ui/StateView'

interface State {
  error: Error | null
}

/**
 * Last line of defence: a screen that crashes shows what happened and two ways out instead of a blank
 * page. Local data is never deleted from here without the crew confirming it.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; onReset?: () => Promise<void> }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('Crew Console screen failed:', error)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const { onReset } = this.props
    return (
      <StateView
        kind="error"
        title="This screen hit an error"
        actions={<>
          <Button onClick={() => this.setState({ error: null })}>Try again</Button>
          {onReset && (
            <Button
              variant="danger"
              onClick={() => {
                if (window.confirm('Erase all local data and reload the demo mission?')) void onReset().then(() => this.setState({ error: null }))
              }}
            >
              Reset demo data
            </Button>
          )}
        </>}
      >
        <p>The on-board data is still on this device. Try the screen again; if it keeps failing, reset the demo data.</p>
        <p className="mono">{error.message}</p>
      </StateView>
    )
  }
}
