export {}

declare global {
  interface Window {
    api: {
      getSettings: () => Promise<{ libraryPath?: string; pythonPath?: string }>
      selectLibraryFolder: () => Promise<string | null>
      scanLibrary: () => Promise<any[]>
      searchAndRescan: (query: string) => Promise<any[]>
      selectPython: () => Promise<string | null>
      selectScraper: () => Promise<string | null>
    }
    electron: typeof import('@electron-toolkit/preload').electronAPI
  }
}
