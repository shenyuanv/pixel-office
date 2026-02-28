# CLAUDE.md — pixel-office

## Project Overview
This is a COMPLETE copy of [pixel-agents](https://github.com/pablodelucca/pixel-agents) — a VS Code extension that renders a pixel art office with animated coding agent characters.

**Goal:** Make it run standalone in Chrome (no VS Code). Keep the EXACT same rendering, sprites, animations, and office scene.

## Architecture (Original)
- `src/` — VS Code extension backend (TypeScript)
  - `extension.ts` — extension entry point, registers webview
  - `PixelAgentsViewProvider.ts` — creates webview panel, sends messages to it
  - `agentManager.ts` — tracks Cline/Copilot agent sessions
  - `assetLoader.ts` — loads sprite PNGs, converts to pixel arrays, sends to webview
  - `fileWatcher.ts` — watches agent transcript files
  - `transcriptParser.ts` — parses agent activity from transcripts
  - `layoutPersistence.ts` — saves/loads office layout to workspace
  - `timerManager.ts` — idle timers for characters
- `webview-ui/` — React + Vite frontend (what renders in the webview panel)
  - `src/App.tsx` — main React app
  - `src/hooks/useExtensionMessages.ts` — listens for messages FROM the extension
  - `src/vscodeApi.ts` — `acquireVsCodeApi()` shim
  - `src/office/engine/` — game loop, renderer, character state machine
  - `src/office/sprites/` — sprite data (procedural color arrays)
  - `src/office/layout/` — tile map, furniture catalog
- `scripts/` — asset processing scripts (Python)
  - `export_sprites.py` — converts PNGs to JSON sprite data
  - `export_characters.py` — converts character PNGs to pre-colored sprite arrays

## The Task
Convert this into a standalone browser app:
1. The extension backend (`src/`) needs to be replaced with in-browser logic
2. Asset loading (sprites, floor tiles, wall tiles, characters, furniture) must happen directly in the browser
3. Agent simulation — create demo agents that cycle through states (typing, walking, reading, idle)
4. The webview-ui becomes the entire app
5. The office scene must look IDENTICAL to how it looks in VS Code

## Key Data Flow (Original)
```
Extension                          Webview
─────────                          ───────
assetLoader → furnitureAssetsLoaded → buildDynamicCatalog()
assetLoader → characterSpritesLoaded → setCharacterTemplates()
assetLoader → floorTilesLoaded → setFloorSprites()
assetLoader → wallTilesLoaded → setWallSprites()
layoutPersistence → layoutLoaded → os.rebuildFromLayout()
agentManager → existingAgents → buffer agents
agentManager → agentCreated → os.addAgent()
agentManager → agentStatus → os.setAgentActive()
transcriptParser → agentToolStart → os.setAgentTool()
```

All of this message passing needs to be replaced with direct function calls in the browser.

## Commands
```bash
# Original (VS Code extension)
cd webview-ui && npm install && npm run dev

# Goal: standalone
npm install && npm run dev  # should show the full office in Chrome
```

## Rules
- Keep the EXACT same visual output — same sprites, same animations, same office
- MIT license — maintain attribution
- No VS Code APIs in the final build
- Must work with just `npm run dev` in Chrome
- **MUST use PNG sprite assets** — load character PNGs, wall tiles, floor tiles, and furniture from `public/assets/`. Do NOT hand-draw sprites with canvas primitives (no `fillRect` pixel-by-pixel drawing). The original pixel-agents uses pre-made PNG spritesheets — keep that approach.
- **NO procedural drawing** — never replace PNG sprites with loops of colored rectangles or hand-coded canvas shapes. The visual quality comes from the PNG art. Use `drawImage()` to render sprites from the spritesheets.
- The `scripts/` directory has export tools that convert PNGs to sprite arrays — use these or load PNGs directly in the browser via Canvas `getImageData()`.
