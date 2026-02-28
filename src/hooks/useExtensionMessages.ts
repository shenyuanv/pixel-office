import { useState, useEffect, useRef } from 'react'
import type { OfficeState } from '../office/engine/officeState.js'
import type { OfficeLayout, ToolActivity } from '../office/types.js'
import { migrateLayoutColors } from '../office/layout/layoutSerializer.js'
import { loadAssets } from '../assetLoader.js'

export interface SubagentCharacter {
  id: number
  parentAgentId: number
  parentToolId: string
  label: string
}

export interface FurnitureAsset {
  id: string
  name: string
  label: string
  category: string
  file: string
  width: number
  height: number
  footprintW: number
  footprintH: number
  isDesk: boolean
  canPlaceOnWalls: boolean
  partOfGroup?: boolean
  groupId?: string
  canPlaceOnSurfaces?: boolean
  backgroundTiles?: number
}

export interface WorkspaceFolder {
  name: string
  path: string
}

export interface ExtensionMessageState {
  agents: number[]
  selectedAgent: number | null
  agentTools: Record<number, ToolActivity[]>
  agentStatuses: Record<number, string>
  subagentTools: Record<number, Record<string, ToolActivity[]>>
  subagentCharacters: SubagentCharacter[]
  layoutReady: boolean
  workspaceFolders: WorkspaceFolder[]
}

/** Demo agent names used for display */
const DEMO_AGENTS = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
  { id: 3, name: 'Carol' },
  { id: 4, name: 'Dave' },
]

/** Tools that simulate coding activity */
const DEMO_TOOLS = ['Read', 'Edit', 'Bash', 'Grep', 'Write', 'Glob', 'WebFetch']

export function useExtensionMessages(
  getOfficeState: () => OfficeState,
  onLayoutLoaded?: (layout: OfficeLayout) => void,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _isEditDirty?: () => boolean,
): ExtensionMessageState {
  const [agents, setAgents] = useState<number[]>([])
  const [selectedAgent, setSelectedAgent] = useState<number | null>(null)
  const [agentTools, setAgentTools] = useState<Record<number, ToolActivity[]>>({})
  const [agentStatuses, setAgentStatuses] = useState<Record<number, string>>({})
  const [subagentTools] = useState<Record<number, Record<string, ToolActivity[]>>>({})
  const [subagentCharacters] = useState<SubagentCharacter[]>([])
  const [layoutReady, setLayoutReady] = useState(false)
  const [workspaceFolders] = useState<WorkspaceFolder[]>([])

  const initDone = useRef(false)

  useEffect(() => {
    if (initDone.current) return
    initDone.current = true

    const os = getOfficeState()

    // Load PNG assets and layout in parallel, then create demo agents
    Promise.all([
      loadAssets(),
      fetch('./assets/default-layout.json')
        .then((res) => {
          if (!res.ok) throw new Error('not found')
          return res.json()
        })
        .then((rawLayout: OfficeLayout) => {
          const layout = rawLayout.version === 1 ? migrateLayoutColors(rawLayout) : null
          if (layout) {
            os.rebuildFromLayout(layout)
            onLayoutLoaded?.(layout)
          } else {
            onLayoutLoaded?.(os.getLayout())
          }
        })
        .catch(() => {
          // Use built-in default layout
          onLayoutLoaded?.(os.getLayout())
        }),
    ]).then(() => {
      // Add demo agents after assets and layout are ready
      const agentIds = DEMO_AGENTS.map((a) => a.id)
      for (const agent of DEMO_AGENTS) {
        os.addAgent(agent.id, undefined, undefined, undefined, true)
      }
      setAgents(agentIds)
      setSelectedAgent(null)
      setLayoutReady(true)

      // Start all agents as active (typing at their desks)
      for (const agent of DEMO_AGENTS) {
        os.setAgentActive(agent.id, true)
      }

      // Start demo activity cycle
      startDemoCycle(os, agentIds, setAgentTools, setAgentStatuses)
    })
  }, [getOfficeState, onLayoutLoaded])

  return { agents, selectedAgent, agentTools, agentStatuses, subagentTools, subagentCharacters, layoutReady, workspaceFolders }
}

/** Simulate agent activity: periodically toggle active/inactive and cycle tools */
function startDemoCycle(
  os: OfficeState,
  agentIds: number[],
  setAgentTools: React.Dispatch<React.SetStateAction<Record<number, ToolActivity[]>>>,
  setAgentStatuses: React.Dispatch<React.SetStateAction<Record<number, string>>>,
): void {
  let toolCounter = 0

  // Give each agent an initial tool
  for (const id of agentIds) {
    const tool = DEMO_TOOLS[Math.floor(Math.random() * DEMO_TOOLS.length)]
    os.setAgentTool(id, tool)
    setAgentTools((prev) => ({
      ...prev,
      [id]: [{ toolId: `t-${toolCounter++}`, status: `Using ${tool}`, done: false }],
    }))
  }

  // Periodically cycle agent states
  const interval = setInterval(() => {
    const id = agentIds[Math.floor(Math.random() * agentIds.length)]
    const ch = os.characters.get(id)
    if (!ch) return

    if (ch.isActive) {
      // 30% chance to go idle (take a break)
      if (Math.random() < 0.3) {
        os.setAgentActive(id, false)
        os.setAgentTool(id, null)
        setAgentTools((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
        setAgentStatuses((prev) => ({ ...prev, [id]: 'idle' }))
      } else {
        // Switch to a different tool
        const tool = DEMO_TOOLS[Math.floor(Math.random() * DEMO_TOOLS.length)]
        os.setAgentTool(id, tool)
        setAgentTools((prev) => ({
          ...prev,
          [id]: [{ toolId: `t-${toolCounter++}`, status: `Using ${tool}`, done: false }],
        }))
      }
    } else {
      // Inactive agent comes back to work
      os.setAgentActive(id, true)
      const tool = DEMO_TOOLS[Math.floor(Math.random() * DEMO_TOOLS.length)]
      os.setAgentTool(id, tool)
      setAgentTools((prev) => ({
        ...prev,
        [id]: [{ toolId: `t-${toolCounter++}`, status: `Using ${tool}`, done: false }],
      }))
      setAgentStatuses((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    }
  }, 4000 + Math.random() * 3000)

  // Store interval on window for cleanup (not strictly necessary for SPA)
  ;(window as unknown as Record<string, unknown>).__demoInterval = interval
}
