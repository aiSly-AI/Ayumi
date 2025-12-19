import * as fs from 'node:fs'

import path from 'node:path'

import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

import icon from '../../resources/icon.png?asset'

import { loadSettings, saveSettings } from './library/settings'
import { scanLibrary } from './library/scanLibrary'
import { spawn } from 'node:child_process'


function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function cleanPath(p: string): string {
  return p.trim().replace(/^"+|"+$/g, '')
}

ipcMain.handle('settings:get', () => {
  return loadSettings()
})

ipcMain.handle('settings:selectLibraryFolder', async () => {
  const res = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory']
  })
  if (res.canceled || res.filePaths.length === 0) return null

  const libraryPath = res.filePaths[0]
  const current = loadSettings()
  saveSettings({ ...current, libraryPath })
  return libraryPath
})

ipcMain.handle('library:scan', () => {
  const { libraryPath } = loadSettings()
  if (!libraryPath) return []
  return scanLibrary(libraryPath)
})

ipcMain.handle('settings:selectPython', async () => {
  const res = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Python', extensions: ['exe'] }]
  })
  if (res.canceled || !res.filePaths[0]) return null

  const pythonPath = res.filePaths[0]
  const s = loadSettings()
  saveSettings({ ...s, pythonPath })
  return pythonPath
})

ipcMain.handle('settings:selectScraper', async () => {
  const res = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Python script', extensions: ['py'] }]
  })
  if (res.canceled || !res.filePaths[0]) return null

  const scraperPath = res.filePaths[0]
  const s = loadSettings()
  saveSettings({ ...s, scraperPath })
  return scraperPath
})

ipcMain.handle('scraper:search', async (_event, query: string) => {
   const settings = loadSettings()
  const { libraryPath, pythonPath, scraperPath } = settings

  if (!libraryPath) throw new Error('Aucun dossier bibliothèque configuré')
  if (!pythonPath || !fs.existsSync(pythonPath)) throw new Error('Chemin Python invalide')
  if (!scraperPath || !fs.existsSync(scraperPath)) throw new Error('Chemin scraper invalide')
  if (!query || !query.trim()) throw new Error('Requête vide')

  // IMPORTANT: tu lances le scraper dans le parent pour éviter data/data
  const parent = path.dirname(libraryPath)
  if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true })
  if (!fs.existsSync(libraryPath)) fs.mkdirSync(libraryPath, { recursive: true })

  const win = BrowserWindow.getAllWindows()[0]
  const py = cleanPath(pythonPath)
  const script = cleanPath(scraperPath)

  // Événement début
  win?.webContents.send('scraper:progress', { type: 'start', query: query.trim() })

  return await new Promise((resolve, reject) => {
    const child = spawn(py, [script, '-q', query.trim()], {
      cwd: parent,
      windowsHide: true,
      shell: false
    })

    let stdoutBuf = ''
    let stderrBuf = ''

    const pushLines = (chunk: Buffer, channel: 'stdout' | 'stderr') => {
      const str = chunk.toString()
      if (channel === 'stdout') stdoutBuf += str
      else stderrBuf += str

      // On envoie le texte brut (ou ligne par ligne)
      win?.webContents.send('scraper:progress', { type: channel, text: str })
    }

    child.stdout.on('data', (d) => pushLines(d, 'stdout'))
    child.stderr.on('data', (d) => pushLines(d, 'stderr'))

    child.on('error', (err) => {
      win?.webContents.send('scraper:progress', { type: 'error', message: String(err) })
      reject(err)
    })

    child.on('close', (code) => {
      if (code !== 0) {
        win?.webContents.send('scraper:progress', {
          type: 'done',
          ok: false,
          code,
          stderr: stderrBuf
        })
        reject(new Error(`Scraper error (${code})\n${stderrBuf || stdoutBuf}`))
        return
      }

      // Success: rescan
      const next = scanLibrary(libraryPath)
      win?.webContents.send('scraper:progress', { type: 'done', ok: true })
      resolve(next)
    })
  })
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
