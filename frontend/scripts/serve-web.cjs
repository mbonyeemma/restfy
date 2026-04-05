#!/usr/bin/env node
/**
 * Serves the Vite-built static web app (out/renderer).
 * Uses PORT when set (Render, Railway, Fly, etc.), else 8787.
 */
const { spawn } = require('child_process')
const path = require('path')

const port = String(process.env.PORT || '8787')
const root = path.join(__dirname, '..', 'out', 'renderer')
const cli = require.resolve('http-server/bin/http-server')
const proxy = `http://127.0.0.1:${port}/?`

const child = spawn(
  process.execPath,
  [cli, root, '-p', port, '-c-1', '--proxy', proxy],
  { stdio: 'inherit' }
)
child.on('exit', (code) => process.exit(code ?? 0))
