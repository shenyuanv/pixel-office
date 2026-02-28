# CLAUDE.md — pixel-office

## Project Overview
Browser-based pixel art coding agent dashboard, forked from [pixel-agents](https://github.com/pablodelucca/pixel-agents) (VS Code extension). The goal is to make it run standalone in Chrome with no VS Code dependency.

## Origin
The `webview-ui/` directory from pixel-agents was copied as the project root. It's a React + Vite + TypeScript app that renders a pixel art office with animated characters representing coding agents.

## Tech Stack
- **React 19** + TypeScript + Vite
- **Canvas-based rendering** — pixel art office scene
- **No external image assets** — all sprites are procedural (2D string arrays of hex colors)

## Architecture
- `src/office/engine/` — game loop, renderer, character state machine, office state
- `src/office/sprites/` — sprite data (characters, furniture) as color arrays
- `src/office/layout/` — tile map, furniture catalog, layout serialization
- `src/hooks/` — React hooks (formerly VS Code message handlers)
- `src/vscodeApi.ts` — **TO BE REPLACED** — VS Code API shim
- `src/App.tsx` — main app component

## Key Concepts
- **Characters**: 16×24 px sprites, 6 palettes, template-based coloring (H=hair, K=skin, S=shirt, P=pants, O=shoes, E=eyes)
- **States**: typing, walking, reading, waiting, idle — with directional sprites and animation frames
- **Office**: Tile-based grid with floor, walls, desks, furniture
- **Data flow**: Originally VS Code sends messages → webview. Now needs standalone data source.

## Commands
```bash
npm install          # Install dependencies
npm run dev          # Dev server (Vite)
npm run build        # Production build
npm run lint         # ESLint
```

## Rules
- Keep it a single `npm run dev` experience — no external servers needed
- All rendering must work in Chrome (no VS Code APIs)
- Maintain MIT license attribution to original pixel-agents project
- Don't break the sprite/animation system — it's the core value
