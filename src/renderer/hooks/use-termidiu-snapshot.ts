import { useEffect, useState } from 'react'
import type { AppState } from '../../shared/contracts'
import { emptySnapshot, termidiuApi } from '../lib/termidiu-api'
import { publishTerminalOutput } from '../lib/terminal-event-bus'

export function useTermidiuSnapshot() {
  const [snapshot, setSnapshot] = useState<AppState>(emptySnapshot)

  useEffect(() => {
    let disposed = false

    const loadSnapshot = async (): Promise<void> => {
      const next = await termidiuApi.getInitialState()
      if (!disposed) {
        setSnapshot(next)
      }
    }

    void loadSnapshot()

    const unsubscribeState = termidiuApi.onStateChanged(event => {
      setSnapshot(event.state)
    })

    const unsubscribeOutput = termidiuApi.onTerminalOutput(event => {
      publishTerminalOutput(event.sessionId, event.data)
    })

    return () => {
      disposed = true
      unsubscribeState()
      unsubscribeOutput()
    }
  }, [])

  return snapshot
}
