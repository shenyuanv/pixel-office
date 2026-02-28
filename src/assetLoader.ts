/**
 * Browser-based asset loader: loads PNG sprite sheets and converts them
 * to SpriteData (2D hex-color arrays) using canvas getImageData.
 *
 * Replaces the Node.js-based extension assetLoader that used pngjs.
 */

import type { SpriteData } from './office/types.js'
import { setCharacterTemplates } from './office/sprites/spriteData.js'
import { setWallSprites } from './office/wallTiles.js'

// ── Constants (match scripts/export-characters.ts and src/constants.ts) ──

const CHAR_FRAME_W = 16
const CHAR_FRAME_H = 32 // full cell height (includes 8px transparent padding at top)
const CHAR_FRAMES_PER_ROW = 7
const CHAR_COUNT = 6

const WALL_PIECE_W = 16
const WALL_PIECE_H = 32
const WALL_GRID_COLS = 4
const WALL_BITMASK_COUNT = 16

const ALPHA_THRESHOLD = 128

// ── Helpers ─────────────────────────────────────────────────

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`))
    img.src = url
  })
}

function getPixelData(img: HTMLImageElement): { data: Uint8ClampedArray; width: number } {
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, img.width, img.height)
  return { data: imageData.data, width: img.width }
}

function extractSprite(
  data: Uint8ClampedArray,
  imgWidth: number,
  x: number,
  y: number,
  w: number,
  h: number,
): SpriteData {
  const rows: string[][] = []
  for (let row = 0; row < h; row++) {
    const cols: string[] = []
    for (let col = 0; col < w; col++) {
      const idx = ((y + row) * imgWidth + (x + col)) * 4
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]
      const a = data[idx + 3]
      if (a < ALPHA_THRESHOLD) {
        cols.push('')
      } else {
        cols.push(
          `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`,
        )
      }
    }
    rows.push(cols)
  }
  return rows
}

// ── Character sprites ───────────────────────────────────────

/**
 * Load character sprite sheets from /assets/characters/char_N.png.
 *
 * Each PNG is 112×96: 7 columns × 16px, 3 rows × 32px.
 * Row 0 = down, Row 1 = up, Row 2 = right.
 * Frame order: walk1, walk2, walk3, type1, type2, read1, read2.
 * Sprite data is 24px tall, bottom-aligned in 32px frame (8px padding at top).
 */
async function loadCharacters(): Promise<void> {
  const characters: Array<{ down: SpriteData[]; up: SpriteData[]; right: SpriteData[] }> = []

  for (let i = 0; i < CHAR_COUNT; i++) {
    const img = await loadImage(`./assets/characters/char_${i}.png`)
    const { data, width } = getPixelData(img)

    const extractRow = (dirIdx: number): SpriteData[] => {
      const sprites: SpriteData[] = []
      const rowY = dirIdx * CHAR_FRAME_H
      for (let f = 0; f < CHAR_FRAMES_PER_ROW; f++) {
        sprites.push(extractSprite(data, width, f * CHAR_FRAME_W, rowY, CHAR_FRAME_W, CHAR_FRAME_H))
      }
      return sprites
    }

    characters.push({
      down: extractRow(0),
      up: extractRow(1),
      right: extractRow(2),
    })
  }

  setCharacterTemplates(characters)
}

// ── Wall sprites ────────────────────────────────────────────

/**
 * Load wall tile sprites from /assets/walls.png.
 *
 * The PNG is 64×128: 4 columns × 16px, 4 rows × 32px = 16 sprites.
 * Piece at bitmask M: col = M % 4, row = floor(M / 4).
 */
async function loadWalls(): Promise<void> {
  const img = await loadImage('./assets/walls.png')
  const { data, width } = getPixelData(img)

  const sprites: SpriteData[] = []
  for (let mask = 0; mask < WALL_BITMASK_COUNT; mask++) {
    const col = mask % WALL_GRID_COLS
    const row = Math.floor(mask / WALL_GRID_COLS)
    sprites.push(extractSprite(data, width, col * WALL_PIECE_W, row * WALL_PIECE_H, WALL_PIECE_W, WALL_PIECE_H))
  }

  setWallSprites(sprites)
}

// ── Public API ──────────────────────────────────────────────

/**
 * Load all PNG assets and initialize sprite systems.
 * Falls back gracefully — the app still works with procedural sprites if PNGs fail.
 */
export async function loadAssets(): Promise<void> {
  await Promise.all([
    loadCharacters().catch((err) => console.warn('Character PNGs not loaded, using procedural sprites:', err)),
    loadWalls().catch((err) => console.warn('Wall PNGs not loaded, using flat wall colors:', err)),
  ])
}
