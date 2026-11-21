import { avoidPhysicalControls, cablePoint, frontButtonExclusion } from './cableGeometry'
import { cableInfo, type CableId, type HardwareState } from './hardware'

type Point = { x: number; y: number }
const order = Object.keys(cableInfo) as CableId[]

function dock(cable: CableId, end: number): Point {
  if (cable === 'ac') return end ? { x: 295, y: 650 } : { x: 225, y: 650 }
  if (cable === 'front_panel') return end ? { x: 720, y: 665 } : { x: 690, y: 630 }
  const index = order.indexOf(cable)
  const column = index % 5
  return { x: 175 + column * 180 - (column === 3 ? 54 : 0) + end * 62, y: index < 5 ? 615 : 660 }
}

export function cableLayout(state: HardwareState, cable: CableId, preview?: { connector: string; point: Point }) {
  const index = order.indexOf(cable)
  const ends = cableInfo[cable].ends.map((connector, end) => {
    const connected = state.connections[cable].includes(connector)
    return {
      connector,
      connected,
      point: preview?.connector === connector ? avoidPhysicalControls(preview.point, state.objects) : connected ? cablePoint(connector, state.objects) : avoidPhysicalControls(state.cableEnds[cable][connector] ?? dock(cable, end), state.objects),
    }
  })
  const [a, b] = ends
  const status = ends.every(end => end.connected) ? 'connected' : ends.some(end => end.connected) ? 'partial' : 'coiled'
  const dx = b.point.x - a.point.x
  const dy = b.point.y - a.point.y
  const distance = Math.hypot(dx, dy) || 1
  const bend = (index % 2 ? 1 : -1) * Math.min(18, distance * .04)
  const control = (fraction: number) => ({
    x: Math.round((a.point.x + dx * fraction - dy / distance * bend) * 10) / 10,
    y: Math.round((a.point.y + dy * fraction + dx / distance * bend) * 10) / 10,
  })
  const c1 = control(1 / 3), c2 = control(2 / 3)
  const crossesButton = Math.min(a.point.x, b.point.x) < frontButtonExclusion.right && Math.max(a.point.x, b.point.x) > frontButtonExclusion.left && Math.min(a.point.y, b.point.y) < frontButtonExclusion.bottom && Math.max(a.point.y, b.point.y) > frontButtonExclusion.top
  const path = cable === 'front_panel' || crossesButton
    ? `M ${a.point.x} ${a.point.y} L ${a.point.x} 570 L ${b.point.x} 570 L ${b.point.x} ${b.point.y}`
    : status === 'coiled' && !state.cableEnds[cable][a.connector] && !state.cableEnds[cable][b.connector] && !preview
    ? `M ${a.point.x} ${a.point.y} C ${a.point.x - 30} ${a.point.y - 55}, ${a.point.x + 48} ${a.point.y - 55}, ${a.point.x + 11} ${a.point.y - 28} C ${a.point.x - 12} ${a.point.y - 11}, ${b.point.x + 29} ${b.point.y - 46}, ${b.point.x} ${b.point.y}`
    : `M ${a.point.x} ${a.point.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.point.x} ${b.point.y}`
  return { ends, status, path }
}
