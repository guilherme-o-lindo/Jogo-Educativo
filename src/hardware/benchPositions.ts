import { cableDistance, cableTension } from './cableGeometry'
import { SCENE_WIDTH, cableInfo, type CableId, type HardwareState } from './hardware'

type ObjectId = keyof HardwareState['objects']
type MovableObjectId = Exclude<ObjectId, 'motherboard'>
type Point = { x: number; y: number }
type Rect = { left: number; top: number; right: number; bottom: number }

const footprints: Record<ObjectId, Rect> = {
  motherboard: { left: -295, top: -250, right: 290, bottom: 250 },
  psu: { left: -80, top: -94, right: 80, bottom: 66 },
  ssd: { left: -80, top: -59, right: 87, bottom: 57 },
  monitor: { left: -98, top: -95, right: 99, bottom: 95 },
}
const fixtures: Rect[] = [
  { left: 45, top: 563, right: 213, bottom: 657 },
  { left: 787, top: 604, right: 876, bottom: 678 },
]
const clearance = 8

function placed(bounds: Rect, point: Point): Rect {
  return { left: bounds.left + point.x, right: bounds.right + point.x, top: bounds.top + point.y, bottom: bounds.bottom + point.y }
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.left < b.right + clearance && a.right + clearance > b.left && a.top < b.bottom + clearance && a.bottom + clearance > b.top
}

// Procura o ponto livre mais próximo, incluindo limites dos obstáculos.
export function resolveObjectPosition(object: MovableObjectId, desired: Point, objects: HardwareState['objects']): Point {
  const bounds = footprints[object]
  const obstacles = [
    ...fixtures,
    ...(Object.keys(footprints) as ObjectId[]).filter(id => id !== object).map(id => placed(footprints[id], objects[id])),
  ]
  const minX = -bounds.left, maxX = SCENE_WIDTH - bounds.right
  const minY = -bounds.top, maxY = 700 - bounds.bottom
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
  const xs = [clamp(desired.x, minX, maxX), minX, maxX, ...obstacles.flatMap(rect => [rect.left - clearance - bounds.right, rect.right + clearance - bounds.left])].filter(x => x >= minX && x <= maxX)
  const ys = [clamp(desired.y, minY, maxY), minY, maxY, ...obstacles.flatMap(rect => [rect.top - clearance - bounds.bottom, rect.bottom + clearance - bounds.top])].filter(y => y >= minY && y <= maxY)
  let best: Point | null = null
  let distance = Infinity
  for (const x of xs) for (const y of ys) {
    const candidate = { x, y }
    if (obstacles.some(rect => overlaps(placed(bounds, candidate), rect))) continue
    const next = Math.hypot(x - desired.x, y - desired.y)
    if (next < distance) { best = candidate; distance = next }
  }
  return best ?? objects[object]
}

export const objectPositions: Record<MovableObjectId, readonly { id: string; name: string; point: Point }[]> = {
  psu: [
    { id: 'upper', name: 'Fonte · posição superior', point: { x: 115, y: 245 } },
    { id: 'lower', name: 'Fonte · posição inferior', point: { x: 115, y: 395 } },
  ],
  ssd: [
    { id: 'bay', name: 'SSD · baia', point: { x: 965, y: 450 } },
    { id: 'bench', name: 'SSD · bancada', point: { x: 970, y: 555 } },
  ],
  monitor: [
    { id: 'upper', name: 'Monitor · posição superior', point: { x: 965, y: 190 } },
    { id: 'lower', name: 'Monitor · posição inferior', point: { x: 965, y: 280 } },
  ],
}

export function positionCableStatus(state: HardwareState, object: MovableObjectId, point: Point) {
  const objects = { ...state.objects, [object]: point }
  return (Object.keys(cableInfo) as CableId[])
    .filter(cable => state.connections[cable].length === 2 && state.cables[cable].condition === 'good')
    .map(cable => ({ cable, status: cableTension(cableDistance(cable, objects, cableInfo[cable].ends), state.cables[cable].length) }))
    .filter(item => item.status !== 'slack')
}
