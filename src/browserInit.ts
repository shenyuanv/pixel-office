/**
 * Browser-side asset initialization for standalone mode.
 *
 * Loads furniture catalog + PNGs, wall tiles, character sprites,
 * and the default layout — replacing the VS Code extension message pipeline.
 */

import type { OfficeState } from './office/engine/officeState.js'
import type { OfficeLayout } from './office/types.js'
import { buildDynamicCatalog } from './office/layout/furnitureCatalog.js'
import { setWallSprites } from './office/wallTiles.js'
import { setCharacterTemplates } from './office/sprites/spriteData.js'
import { migrateLayoutColors } from './office/layout/layoutSerializer.js'
import type { FurnitureAsset } from './hooks/useExtensionMessages.js'

// Constants matching src/constants.ts (extension side)
const PNG_ALPHA_THRESHOLD = 128
const WALL_PIECE_WIDTH = 16
const WALL_PIECE_HEIGHT = 32
const WALL_GRID_COLS = 4
const WALL_BITMASK_COUNT = 16
const CHAR_FRAME_W = 16
const CHAR_FRAME_H = 32
const CHAR_FRAMES_PER_ROW = 7
const CHAR_COUNT = 6
const CHARACTER_DIRECTIONS = ['down', 'up', 'right'] as const

export interface BrowserInitResult {
  loadedAssets?: { catalog: FurnitureAsset[]; sprites: Record<string, string[][]> }
  layout?: OfficeLayout
}

/** Load a PNG image and return its ImageData */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load: ${url}`))
    img.src = url
  })
}

/** Convert a region of image pixel data to SpriteData (string[][]) */
function regionToSprite(
  data: Uint8ClampedArray,
  imgWidth: number,
  ox: number,
  oy: number,
  w: number,
  h: number,
): string[][] {
  const sprite: string[][] = []
  for (let y = 0; y < h; y++) {
    const row: string[] = []
    for (let x = 0; x < w; x++) {
      const idx = ((oy + y) * imgWidth + (ox + x)) * 4
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]
      const a = data[idx + 3]
      if (a < PNG_ALPHA_THRESHOLD) {
        row.push('')
      } else {
        row.push(
          `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase(),
        )
      }
    }
    sprite.push(row)
  }
  return sprite
}

/** Load a PNG and convert the full image to SpriteData */
async function loadPngAsSprite(url: string): Promise<string[][]> {
  const img = await loadImage(url)
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, img.width, img.height)
  return regionToSprite(data, img.width, 0, 0, img.width, img.height)
}

/** Load wall tiles from walls.png (64x128, 4x4 grid of 16x32 pieces) */
async function loadWallTileSprites(): Promise<boolean> {
  try {
    const img = await loadImage('assets/walls.png')
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const { data } = ctx.getImageData(0, 0, img.width, img.height)

    const sprites: string[][][] = []
    for (let mask = 0; mask < WALL_BITMASK_COUNT; mask++) {
      const ox = (mask % WALL_GRID_COLS) * WALL_PIECE_WIDTH
      const oy = Math.floor(mask / WALL_GRID_COLS) * WALL_PIECE_HEIGHT
      sprites.push(regionToSprite(data, img.width, ox, oy, WALL_PIECE_WIDTH, WALL_PIECE_HEIGHT))
    }
    setWallSprites(sprites)
    console.log(`[Browser] Loaded ${sprites.length} wall tile sprites`)
    return true
  } catch {
    console.log('[Browser] No wall tiles found, using fallback')
    return false
  }
}

/** Load pre-colored character sprites from assets/characters/char_N.png */
async function loadCharacterSpriteData(): Promise<boolean> {
  try {
    const characters: Array<{ down: string[][][]; up: string[][][]; right: string[][][] }> = []

    for (let ci = 0; ci < CHAR_COUNT; ci++) {
      const img = await loadImage(`assets/characters/char_${ci}.png`)
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const { data } = ctx.getImageData(0, 0, img.width, img.height)

      const charData: { down: string[][][]; up: string[][][]; right: string[][][] } = {
        down: [],
        up: [],
        right: [],
      }

      for (let dirIdx = 0; dirIdx < CHARACTER_DIRECTIONS.length; dirIdx++) {
        const dir = CHARACTER_DIRECTIONS[dirIdx]
        const rowOffsetY = dirIdx * CHAR_FRAME_H
        const frames: string[][][] = []

        for (let f = 0; f < CHAR_FRAMES_PER_ROW; f++) {
          frames.push(
            regionToSprite(data, img.width, f * CHAR_FRAME_W, rowOffsetY, CHAR_FRAME_W, CHAR_FRAME_H),
          )
        }
        charData[dir] = frames
      }
      characters.push(charData)
    }

    setCharacterTemplates(characters)
    console.log(`[Browser] Loaded ${characters.length} character sprites`)
    return true
  } catch {
    console.log('[Browser] No character sprites found, using fallback')
    return false
  }
}

/** Load furniture catalog + PNGs and build the dynamic catalog */
async function loadFurnitureAssets(): Promise<BrowserInitResult['loadedAssets']> {
  try {
    const resp = await fetch('assets/furniture/furniture-catalog.json')
    if (!resp.ok) return undefined

    const catalogData = await resp.json()
    const catalog: FurnitureAsset[] = catalogData.assets || []
    const sprites: Record<string, string[][]> = {}

    await Promise.all(
      catalog.map(async (asset) => {
        try {
          let filePath = asset.file
          if (!filePath.startsWith('assets/')) filePath = `assets/${filePath}`
          sprites[asset.id] = await loadPngAsSprite(filePath)
        } catch {
          // skip individual sprite failures
        }
      }),
    )

    const ok = buildDynamicCatalog({ catalog, sprites })
    if (ok) {
      console.log(`[Browser] Built dynamic catalog with ${Object.keys(sprites).length} sprites`)
      return { catalog, sprites }
    }
  } catch {
    // No catalog available
  }
  return undefined
}

/** Initialize all assets for standalone browser mode */
export async function initBrowserAssets(os: OfficeState): Promise<BrowserInitResult> {
  const result: BrowserInitResult = {}

  // Load wall tiles and character sprites in parallel with furniture
  const [loadedAssets] = await Promise.all([
    loadFurnitureAssets(),
    loadWallTileSprites(),
    loadCharacterSpriteData(),
  ])

  if (loadedAssets) {
    result.loadedAssets = loadedAssets
  }

  // Only load default-layout.json if we have the dynamic catalog,
  // since it references ASSET_* types that need dynamic sprites.
  // Without the catalog, OfficeState's createDefaultLayout() is used
  // which has hardcoded furniture that renders correctly.
  if (loadedAssets) {
    try {
      const resp = await fetch('assets/default-layout.json')
      if (resp.ok) {
        const rawLayout = (await resp.json()) as OfficeLayout
        if (rawLayout?.version === 1) {
          const layout = migrateLayoutColors(rawLayout)
          os.rebuildFromLayout(layout)
          result.layout = layout
          console.log(`[Browser] Loaded layout (${layout.cols}x${layout.rows})`)
        }
      }
    } catch {
      // Use existing createDefaultLayout()
    }
  }

  return result
}
