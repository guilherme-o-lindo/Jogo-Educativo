import type { CableId, HardwareAction, PartId } from './hardware'

export const replacementParts: PartId[] = ['cpu_i5', 'cooler_stock', 'ram_good', 'gpu', 'ssd_sata_good', 'button_good', 'ssd_m2']
export const replacementCables: CableId[] = ['ac', 'atx24', 'eps8', 'cpu_fan', 'front_panel', 'sata_data', 'sata_power', 'hdmi', 'vga']

export function cupboardAction(item: PartId | CableId | 'psu'): HardwareAction {
  if (item === 'psu') return { type: 'replacePsu' }
  if (replacementCables.includes(item as CableId)) return { type: 'replaceCable', cable: item as CableId }
  return { type: 'takePart', part: item as PartId }
}
