import { createGame, HEIGHT, WIDTH, type Game, type TicketStatus } from './game'
import { SCENE_WIDTH, cableInfo, partInfo, slotInfo, type CableId, type HardwareCaseId, type HardwareState, type PartId } from '../hardware/hardware'

const KEY = 'oficina-ti-session'
const VERSION = 3
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>
export interface Session { started: boolean; game: Game }
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

function migrateHardware(value: unknown, id: HardwareCaseId): HardwareState | null {
  const fresh = createGame().hardware[id]
  if (!object(value) || value.caseId !== id || !object(value.parts) || !object(value.connections)) return null
  const parts = { ...fresh.parts }
  for (const slot of Object.keys(slotInfo) as (keyof typeof parts)[]) {
    const part = value.parts[slot]
    if (part !== null && (typeof part !== 'string' || !slotInfo[slot].accepts.includes(part as PartId))) return null
    parts[slot] = part as PartId | null
  }
  const connections = { ...fresh.connections }
  const cableEnds = { ...fresh.cableEnds }
  for (const cable of Object.keys(cableInfo) as CableId[]) {
    const ends = value.connections[cable]
    if (!Array.isArray(ends) || ends.length > 2 || !ends.every(end => typeof end === 'string' && cableInfo[cable].ends.includes(end))) return null
    connections[cable] = ends
    const positions = object(value.cableEnds) ? value.cableEnds[cable] : null
    if (object(positions)) for (const end of cableInfo[cable].ends) {
      const point = positions[end]
      if (object(point) && typeof point.x === 'number' && typeof point.y === 'number' && Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.x <= SCENE_WIDTH && point.y >= 0 && point.y <= 700 && !ends.includes(end)) cableEnds[cable][end] = { x: point.x, y: point.y }
    }
  }
  if (!Array.isArray(value.inventory) || !value.inventory.every(part => typeof part === 'string' && part in partInfo)) return null
  if (!Array.isArray(value.journal) || value.journal.length > 100 || !value.journal.every(entry => typeof entry === 'string')) return null
  if (typeof value.psuOn !== 'boolean' || typeof value.powered !== 'boolean' || typeof value.feedback !== 'string') return null
  const psu = object(value.psu) && ['automatic', 'manual'].includes(value.psu.kind as string) && [127, 220].includes(value.psu.voltage as number) && typeof value.psu.failed === 'boolean'
    ? { ...fresh.psu, kind: value.psu.kind as 'automatic' | 'manual', voltage: value.psu.voltage as 127 | 220, failed: value.psu.failed as boolean } : fresh.psu
  const cables = { ...fresh.cables }
  if (object(value.cables)) for (const cable of Object.keys(cableInfo) as CableId[]) {
    const item = value.cables[cable]
    if (object(item) && ['good', 'broken'].includes(item.condition as string)) cables[cable] = { ...cables[cable], condition: item.condition as 'good' | 'broken' }
  }
  const objects = { ...fresh.objects }
  if (object(value.objects)) for (const name of ['psu', 'ssd', 'monitor'] as const) {
    const item = value.objects[name]
    if (object(item) && typeof item.x === 'number' && typeof item.y === 'number' && item.x >= 0 && item.x <= SCENE_WIDTH && item.y >= 0 && item.y <= 700) objects[name] = { x: item.x, y: item.y }
  }
  const lastTest = object(value.lastTest) && ['button', 'bridge'].includes(value.lastTest.method as string) && ['no_power', 'cpu_error', 'dram_error', 'video_missing', 'storage_missing', 'storage_fault', 'boot_ok'].includes(value.lastTest.code as string) && typeof value.lastTest.text === 'string'
    ? value.lastTest as HardwareState['lastTest'] : null
  const invalidBridge = lastTest?.method === 'bridge' && connections.front_panel.includes('mb_pwr_sw')
  const loosePositions = Array.isArray(value.loosePositions) && value.loosePositions.length === value.inventory.length && value.loosePositions.every(item => object(item) && typeof item.x === 'number' && typeof item.y === 'number' && item.x >= 0 && item.x <= SCENE_WIDTH && item.y >= 0 && item.y <= 700) ? value.loosePositions as { x: number; y: number }[] : (value.inventory as PartId[]).map((_, index) => ({ x: 850 + index % 5 * 45, y: 580 + Math.floor(index / 5) % 5 * 22 }))
  const looseLocations = Array.isArray(value.looseLocations) && value.looseLocations.length === value.inventory.length && value.looseLocations.every(item => item === 'tray' || item === 'table') ? value.looseLocations as HardwareState['looseLocations'] : (value.inventory as PartId[]).map(() => 'table' as const)
  return { ...fresh, parts, connections, cableEnds, inventory: value.inventory as PartId[], loosePositions, looseLocations, journal: value.journal as string[], psuOn: value.psuOn, powered: invalidBridge ? false : value.powered, feedback: value.feedback, lastTest: invalidBridge ? null : lastTest, psu, cables, objects, stabilizerOn: typeof value.stabilizerOn === 'boolean' ? value.stabilizerOn : true }
}

function migrateGame(value: unknown, version: number): Game | null {
  if (!object(value) || !object(value.player) || !Array.isArray(value.tickets) || !object(value.hardware)) return null
  const x = value.player.x, y = value.player.y
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return null
  if (value.tickets.length !== (version === 1 ? 5 : 8)) return null
  const fresh = createGame()
  const statuses: TicketStatus[] = ['locked', 'waiting', 'active', 'ready', 'done']
  const savedTickets = value.tickets as unknown[]
  const tickets = fresh.tickets.map(ticket => {
    const saved = savedTickets.find((item: unknown) => object(item) && item.id === ticket.id)
    if (!object(saved)) return ticket
    if (!statuses.includes(saved.status as TicketStatus) || typeof saved.feedback !== 'string') return null
    return { ...ticket, status: saved.status as TicketStatus, feedback: saved.feedback }
  })
  if (tickets.includes(null)) return null
  const hardware = { ...fresh.hardware }
  for (const id of Object.keys(hardware) as HardwareCaseId[]) {
    if (version === 1 && !['power', 'video', 'storage'].includes(id)) continue
    const migrated = migrateHardware(value.hardware[id], id)
    if (!migrated) return null
    hardware[id] = migrated
  }
  for (const ticket of tickets) if (ticket?.status === 'ready' && ticket.id.startsWith('hardware-')) {
    const id = ticket.id.replace('hardware-', '') as HardwareCaseId
    if (hardware[id].lastTest?.code !== 'boot_ok' || hardware[id].lastTest?.method !== 'button') ticket.status = 'active'
  }
  const done = tickets.filter(ticket => ticket?.status === 'done').length
  if (value.completed !== done || tickets.filter(ticket => ticket?.status === 'active' || ticket?.status === 'ready').length > 1) return null
  if (version === 1 && tickets.find(ticket => ticket?.id === 'hardware-storage')?.status === 'done') tickets.find(ticket => ticket?.id === 'hardware-psu')!.status = 'waiting'
  const player = version === 1 && y === 4 && (x === 7 || x === 12) ? { x, y: 5 } : { x, y }
  return { phase: done === 8 ? 'finished' : 'playing', completed: done, player, tickets: tickets as Game['tickets'], hardware }
}

export function loadSession(storage: StorageLike): Session | null {
  try {
    const raw = storage.getItem(KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!object(parsed) || ![1, 2, VERSION].includes(parsed.version as number) || typeof parsed.started !== 'boolean') return null
    const game = migrateGame(parsed.game, parsed.version as number)
    return game ? { started: parsed.started, game } : null
  } catch { return null }
}

export function saveSession(storage: StorageLike, session: Session): void {
  try { storage.setItem(KEY, JSON.stringify({ version: VERSION, ...session })) } catch { /* Jogo continua sem armazenamento. */ }
}
