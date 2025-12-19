import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Tu définis ici toutes tes fonctions "api"
const api = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  selectLibraryFolder: () => ipcRenderer.invoke('settings:selectLibraryFolder'),
  scanLibrary: () => ipcRenderer.invoke('library:scan')
}

// Expose seulement une fois, en respectant context isolation
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}

export type Api = typeof api
