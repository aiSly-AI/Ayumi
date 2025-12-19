import { spawn } from 'node:child_process'

export type RunResult = {
  code: number
  stdout: string
  stderr: string
}

export function runPython(
  pythonPath: string,
  scriptPath: string,
  args: string[],
  cwd?: string
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonPath, [scriptPath, ...args], {
      cwd,
      windowsHide: true,
      shell: false
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (d) => (stdout += d.toString()))
    child.stderr.on('data', (d) => (stderr += d.toString()))

    child.on('error', reject)
    child.on('close', (code) => {
      resolve({ code: code ?? -1, stdout, stderr })
    })
  })
}
