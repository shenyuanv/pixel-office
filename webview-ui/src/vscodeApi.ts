declare function acquireVsCodeApi(): { postMessage(msg: unknown): void }

function getApi(): { postMessage(msg: unknown): void } {
  if (typeof acquireVsCodeApi === 'function') {
    try {
      return acquireVsCodeApi()
    } catch { /* standalone browser */ }
  }
  return { postMessage() {} }
}

export const vscode = getApi()

/** True when running outside VS Code (standalone browser) */
export const isStandalone = typeof acquireVsCodeApi !== 'function'
