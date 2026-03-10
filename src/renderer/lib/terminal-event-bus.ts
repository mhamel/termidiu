type OutputListener = (data: string) => void

const outputListeners = new Map<string, Set<OutputListener>>()
const outputBuffers = new Map<string, string>()

export function subscribeToTerminalOutput(sessionId: string, listener: OutputListener): () => void {
  const listeners = outputListeners.get(sessionId) ?? new Set<OutputListener>()
  listeners.add(listener)
  outputListeners.set(sessionId, listeners)

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      outputListeners.delete(sessionId)
    }
  }
}

export function publishTerminalOutput(sessionId: string, data: string): void {
  outputBuffers.set(sessionId, `${outputBuffers.get(sessionId) ?? ''}${data}`)
  outputListeners.get(sessionId)?.forEach(listener => listener(data))
}

export function getTerminalBuffer(sessionId: string): string {
  return outputBuffers.get(sessionId) ?? ''
}
