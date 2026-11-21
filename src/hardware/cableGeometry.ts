import type { CableId, HardwareState } from './hardware'

export const frontButtonExclusion = { left: 765, top: 582, right: 898, bottom: 700 } as const

export function avoidFrontButton(point: { x: number; y: number }): { x: number; y: number } {
  const area = frontButtonExclusion
  if (point.x < area.left || point.x > area.right || point.y < area.top || point.y > area.bottom) return { x: point.x, y: point.y }
  const options = [{ x: area.left - 1, y: point.y }, { x: area.right + 1, y: point.y }, { x: point.x, y: area.top - 1 }]
  return options.reduce((nearest, option) => Math.hypot(option.x - point.x, option.y - point.y) < Math.hypot(nearest.x - point.x, nearest.y - point.y) ? option : nearest)
}

export function avoidPhysicalControls(point: { x: number; y: number }, objects: HardwareState['objects']) {
  const psu = objects.psu
  const controls = [{ x: 165, y: 585 }, { x: psu.x - 50, y: psu.y - 77 }, { x: psu.x + 55, y: psu.y - 77 }]
  const origin = avoidFrontButton(point)
  const clear = (candidate: { x: number; y: number }) => candidate.x >= 0 && candidate.x <= 1400 && candidate.y >= 0 && candidate.y <= 700
    && controls.every(control => Math.abs(candidate.x - control.x) >= 72 || Math.abs(candidate.y - control.y) >= 72)
    && avoidFrontButton(candidate).x === candidate.x && avoidFrontButton(candidate).y === candidate.y
  if (clear(origin)) return origin
  const candidates = controls.flatMap(control => [
    { x: control.x - 72, y: origin.y }, { x: control.x + 72, y: origin.y },
    { x: origin.x, y: control.y - 72 }, { x: origin.x, y: control.y + 72 },
  ]).filter(clear)
  return candidates.reduce((best, candidate) => Math.hypot(candidate.x - origin.x, candidate.y - origin.y) < Math.hypot(best.x - origin.x, best.y - origin.y) ? candidate : best, candidates[0] ?? origin)
}

const anchors: Record<string, { x: number; y: number; object?: keyof HardwareState['objects'] }> = {
  wall_ac: { x: 86, y: 607 }, psu_ac: { x: 104.5, y: 301, object: 'psu' },
  psu_atx24: { x: 173, y: 216, object: 'psu' }, mb_atx24: { x: 763, y: 227, object: 'motherboard' },
  psu_eps8: { x: 173, y: 255, object: 'psu' }, mb_eps8: { x: 273, y: 134, object: 'motherboard' },
  cooler_fan: { x: 467, y: 254, object: 'motherboard' }, mb_cpu_fan: { x: 510, y: 120, object: 'motherboard' },
  case_button: { x: 750, y: 649 }, mb_pwr_sw: { x: 731, y: 544, object: 'motherboard' },
  mb_sata1: { x: 763, y: 453, object: 'motherboard' }, disk_data: { x: 903, y: 426, object: 'ssd' },
  psu_sata: { x: 173, y: 292, object: 'psu' }, disk_power: { x: 903, y: 466, object: 'ssd' },
  gpu_hdmi: { x: 240, y: 392, object: 'motherboard' }, monitor_hdmi: { x: 867, y: 191, object: 'monitor' },
  mb_vga: { x: 240, y: 313, object: 'motherboard' }, monitor_vga: { x: 867, y: 229, object: 'monitor' },
}
const origins: HardwareState['objects'] = { motherboard: { x: 520, y: 325 }, psu: { x: 115, y: 245 }, ssd: { x: 965, y: 450 }, monitor: { x: 965, y: 190 } }

export function cablePoint(id: string, objects: HardwareState['objects']): { x: number; y: number } {
  const anchor = anchors[id]
  if (!anchor.object) return anchor
  return { x: anchor.x + objects[anchor.object].x - origins[anchor.object].x, y: anchor.y + objects[anchor.object].y - origins[anchor.object].y }
}

export function cableDistance(cable: CableId, objects: HardwareState['objects'], ends: readonly [string, string]): number {
  const a = cablePoint(ends[0], objects), b = cablePoint(ends[1], objects)
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function cableTension(distance: number, length: number): 'slack' | 'tense' | 'broken' {
  if (distance > length) return 'broken'
  return distance >= length * .9 ? 'tense' : 'slack'
}
