---
name: termidiu-dev
description: "How to develop and build TERMIDIU. Covers dev mode, packaging, key paths, native module setup, and desktop shortcut."
targets: ["*"]
---

# TERMIDIU — Dev & Build Guide

TERMIDIU is an Electron + React + TypeScript terminal/script launcher app.

## Stack

- **Electron 40** + **electron-vite 4** for main/preload/renderer builds
- **React 19** + TypeScript renderer
- **node-pty** for terminal emulation (native module, unpacked from asar)
- **xterm.js** for terminal display
- **pnpm** as package manager

## Key paths

```
src/
  main/         → Electron main process (Node.js)
  preload/      → Electron preload bridge
  renderer/     → React app (UI)
    App.tsx         → Root: tabs, sidebar, project tree
    components/     → ProjectTree, FileEditor, Terminal, etc.
  shared/       → Shared types & contracts
resources/
  icon.ico      → App icon
dist/
  win-unpacked/ → Unpacked app (run directly for dev shortcut)
  TERMIDIU.exe  → Portable single-file exe
```

## Start in dev mode

```bash
pnpm run dev
```

Opens the Electron window with hot-reload (Vite HMR for renderer, restart for main).

## Build & package

```bash
pnpm run package
```

This runs:
1. `electron-vite build` — compiles main, preload, renderer
2. `electron-builder` — packages into `dist/win-unpacked/` and `dist/TERMIDIU.exe`
3. `rcedit` — injects the icon into `TERMIDIU.exe`

### Important build flags (electron-builder.yml)
- `npmRebuild: false` — skips native rebuild (node-pty uses prebuilts)
- `asarUnpack: ["node_modules/node-pty/**"]` — keeps native `.node` files outside asar
- `signAndEditExecutable: false` — skips winCodeSign (avoids Windows symlink permission error)

## Desktop shortcut

Run `create-shortcut.ps1` once to create a Desktop shortcut pointing to `dist\win-unpacked\TERMIDIU.exe`.

To pin to taskbar: launch the app, right-click the taskbar icon → "Pin to taskbar".

## Single instance

The app enforces a single instance. Launching a second time focuses the existing window.

## App ID

`com.termidiu` — used for Windows taskbar grouping.
