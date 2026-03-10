# TERMIDIU

> A desktop IDE for PowerShell automation, terminal management, and AI-assisted development.

![Electron](https://img.shields.io/badge/Electron-40-47848F?style=flat&logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat&logo=typescript&logoColor=white)
![Platform](https://img.shields.io/badge/Platform-Windows-0078D4?style=flat&logo=windows&logoColor=white)

---

## Features

- **Project explorer** — Browse and manage PowerShell project folders with live file watching
- **Integrated terminal** — Full PTY terminal via xterm.js and node-pty, with split-pane layouts (1, 1+1, 1+2, 2+2)
- **Script runner** — Execute `.ps1` scripts directly from the file tree, pin favorites for quick access
- **Layout system** — Define complex multi-terminal sessions with `.layout.json` files
- **Code editor** — CodeMirror-powered editor with syntax highlighting and One Dark theme
- **AI agent launcher** — Launch Claude, Gemini, Codex, or Perplexity in integrated terminal windows
- **Workspace tabs** — Unified tab bar for files, terminals, and web views with drag-to-reorder

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Electron + electron-vite |
| UI | React 19 + TypeScript |
| Terminal | xterm.js + node-pty |
| Editor | CodeMirror 6 |
| File watching | chokidar |
| Build | electron-builder |
| Tests | Vitest + Playwright |

---

## Getting Started

**Prerequisites:** Node.js, pnpm

```bash
# Install dependencies
pnpm install

# Start in development mode
pnpm dev

# Run unit tests
pnpm test

# Build for production
pnpm build

# Package as Windows installer
pnpm package
```

---

## Project Structure

```
src/
├── main/               # Electron main process
│   ├── services/       # Terminal, settings, file watcher
│   └── ipc/            # IPC handlers
├── renderer/           # React UI
│   ├── components/     # UI components
│   └── hooks/          # Custom React hooks
└── shared/             # Shared types and utilities
```

---

## License

MIT
