export {}

declare global {
  interface Window {
    api: {
      getSettings: () => Promise<{ libraryPath?: string; pythonPath?: string }>
      selectLibraryFolder: () => Promise<string | null>
      scanLibrary: () => Promise<any[]>
    }
    electron: typeof import('@electron-toolkit/preload').electronAPI
  }
}
