/** Standalone no-op — no VS Code dependency */
export const vscode = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  postMessage(_msg: unknown): void {
    // no-op in standalone mode
  },
}
