import type { SlotId } from './hardware'

type Point = { x: number; y: number }

// O ponto de soltura segue o slot; o centro do desenho pode ser diferente.
export const slotGeometry: Record<SlotId, { target: Point; sprite: Point }> = {
  cpu: { target: { x: 435, y: 230 }, sprite: { x: 435, y: 230 } },
  cooler: { target: { x: 435, y: 230 }, sprite: { x: 435, y: 230 } },
  dimm_a2: { target: { x: 573.5, y: 243.5 }, sprite: { x: 573.5, y: 243.5 } },
  dimm_b2: { target: { x: 621.5, y: 243.5 }, sprite: { x: 621.5, y: 243.5 } },
  pcie_x16: { target: { x: 469, y: 393 }, sprite: { x: 469, y: 359 } },
  m2: { target: { x: 558, y: 466 }, sprite: { x: 558, y: 438 } },
  sata_bay: { target: { x: 968.5, y: 449 }, sprite: { x: 968.5, y: 449 } },
  front_button: { target: { x: 831.5, y: 641 }, sprite: { x: 831.5, y: 641 } },
}

export function slotDropDistance(slot: SlotId, pointer: Point, target: Point): number {
  const { sprite, target: base } = slotGeometry[slot]
  return Math.min(
    Math.hypot(target.x - pointer.x, target.y - pointer.y),
    Math.hypot(target.x - pointer.x - base.x + sprite.x, target.y - pointer.y - base.y + sprite.y),
  )
}
