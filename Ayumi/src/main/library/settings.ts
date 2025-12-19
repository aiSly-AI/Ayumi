import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

export type Settings = {
    libraryPath?: string
    pythonPath?: string
}

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json')

export function loadSettings(): Settings {
    try {
        return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'))
    } catch {
        return {}
    }
}

export function saveSettings(next: Settings): void {
  fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true })
  const tmp = SETTINGS_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf-8')

  // Windows-safe replace
  try {
    fs.rmSync(SETTINGS_FILE, { force: true })
  } catch {}
  
  fs.renameSync(tmp, SETTINGS_FILE)
}


export function getSettingsPath(): string {
    return SETTINGS_FILE
}
