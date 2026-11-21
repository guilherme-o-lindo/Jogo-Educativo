<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  SCENE_WIDTH, cableInfo, connectorInfo, hardwareCases, partInfo, slotInfo,
  type CableId, type HardwareAction, type HardwareCaseId, type HardwareState,
  type PartId, type SlotId,
} from './hardware'
import { avoidPhysicalControls, cablePoint, cableTension as tensionLevel } from './cableGeometry'
import { cableLayout } from './cableRoutes'
import { objectPositions, positionCableStatus, resolveObjectPosition } from './benchPositions'
import { slotDropDistance, slotGeometry } from './sceneGeometry'
import PartSprite from './PartSprite.vue'

const props = defineProps<{ state: HardwareState; caseId: HardwareCaseId; ready: boolean }>()
const emit = defineEmits<{ action: [HardwareAction]; reset: []; close: [] }>()
const scene = ref<HTMLElement | null>(null)
const viewport = ref<HTMLElement | null>(null)
const tray = ref<HTMLElement | null>(null)
type MovableObject = 'psu' | 'ssd' | 'monitor'
type DragTarget = { kind: 'object'; id: MovableObject } | { kind: 'part'; index: number } | { kind: 'cable'; id: CableId; connector: string } | { kind: 'tool' }
let drag: { pointerId: number; target: DragTarget; dx: number; dy: number; clientDx: number; clientDy: number; startX: number; startY: number; moved: boolean; x: number; y: number; release?: HardwareAction } | null = null
const dragView = ref<{ target: DragTarget; x: number; y: number; clientX: number; clientY: number } | null>(null)
let suppressClick = false
const visualObjects = computed(() => dragView.value?.target.kind === 'object' ? { ...props.state.objects, [dragView.value.target.id]: { x: dragView.value.x, y: dragView.value.y } } : props.state.objects)
const visualState = computed(() => ({ ...props.state, objects: visualObjects.value }))
const boardOffset = { x: 0, y: 0 }
const offset = (object: keyof HardwareState['objects']) => ({ x: visualObjects.value[object].x - ({ motherboard: 520, psu: 115, ssd: 965, monitor: 965 })[object], y: visualObjects.value[object].y - ({ motherboard: 325, psu: 245, ssd: 450, monitor: 190 })[object] })
const partSize: Record<SlotId, { width: number; height: number }> = { cpu: { width: 110, height: 100 }, cooler: { width: 90, height: 90 }, dimm_a2: { width: 30, height: 207 }, dimm_b2: { width: 30, height: 207 }, pcie_x16: { width: 295, height: 70 }, m2: { width: 116, height: 42 }, sata_bay: { width: 167, height: 116 }, front_button: { width: 74, height: 74 } }
const draggedPart = computed(() => dragView.value?.target.kind === 'part' ? dragView.value.target.index < props.state.inventory.length ? props.state.inventory[dragView.value.target.index] : drag?.release?.type === 'remove' ? props.state.parts[drag.release.slot] : null : null)
const draggedSlot = computed(() => dragView.value?.target.kind === 'part' && draggedPart.value
  ? compatibleDropSlot(draggedPart.value, dragView.value) : null)
const draggedSprite = computed(() => {
  if (!draggedSlot.value || !scene.value) return null
  const rect = scene.value.getBoundingClientRect()
  const center = spritePoint(draggedSlot.value)
  const size = partSize[draggedSlot.value]
  return { left: `${rect.left + center.x / SCENE_WIDTH * rect.width}px`, top: `${rect.top + center.y / 700 * rect.height}px`, width: `${size.width / SCENE_WIDTH * rect.width}px`, height: `${size.height / 700 * rect.height}px` }
})
const cableTension = (id: CableId) => {
  const ends = cableInfo[id].ends
  if (!props.state.connections[id].length) return false
  const a = props.state.connections[id].includes(ends[0]) ? cablePoint(ends[0], props.state.objects) : props.state.cableEnds[id][ends[0]] ?? cablePoint(ends[0], props.state.objects)
  const b = props.state.connections[id].includes(ends[1]) ? cablePoint(ends[1], props.state.objects) : props.state.cableEnds[id][ends[1]] ?? cablePoint(ends[1], props.state.objects)
  return tensionLevel(Math.hypot(a.x - b.x, a.y - b.y), props.state.cables[id].length) === 'tense'
}
const objectNames = { motherboard: 'placa-mãe', psu: 'fonte', ssd: 'SSD', monitor: 'monitor' }
const controlInfo: Record<string, { name: string; detail: string }> = {
  stabilizer: { name: 'Estabilizador', detail: 'Chave de alimentação junto à tomada.' },
  psuSwitch: { name: 'Chave I/O da fonte', detail: 'Liga ou desliga a saída da fonte.' },
  voltage: { name: 'Seletor de tensão', detail: 'Na fonte manual, ajuste a tensão antes de conectar o cabo de força.' },
}
const movingObject = ref<MovableObject | null>(null)
const proposedPosition = ref<{ x: number; y: number } | null>(null)
const movePreview = computed(() => movingObject.value && proposedPosition.value
  ? positionCableStatus(props.state, movingObject.value, proposedPosition.value) : [])
const moveTarget = computed(() => movingObject.value && proposedPosition.value
  ? { name: 'Posição livre na bancada' } : null)
type Hotspot = { id: string; kind: 'slot' | 'connector' | 'inspect'; x: number; y: number }
type Selection = { kind: 'part' | 'cable'; id: string; index?: number } | null

const hotspots: Hotspot[] = [
  ...(Object.keys(slotGeometry) as SlotId[]).map(id => ({ id, kind: 'slot' as const, ...slotGeometry[id].target })),
  { id: 'wall_ac', kind: 'connector', x: 86, y: 607 }, { id: 'psu_ac', kind: 'connector', x: 104.5, y: 301 },
  { id: 'psu_atx24', kind: 'connector', x: 173, y: 216 }, { id: 'mb_atx24', kind: 'connector', x: 763, y: 227 },
  { id: 'psu_eps8', kind: 'connector', x: 173, y: 255 }, { id: 'mb_eps8', kind: 'connector', x: 273, y: 134 },
  { id: 'cooler_fan', kind: 'connector', x: 467, y: 254 }, { id: 'mb_cpu_fan', kind: 'connector', x: 510, y: 120 },
  { id: 'case_button', kind: 'connector', x: 750, y: 649 }, { id: 'mb_pwr_sw', kind: 'connector', x: 731, y: 544 },
  { id: 'mb_sata1', kind: 'connector', x: 763, y: 453 }, { id: 'disk_data', kind: 'connector', x: 903, y: 426 },
  { id: 'psu_sata', kind: 'connector', x: 173, y: 292 }, { id: 'disk_power', kind: 'connector', x: 903, y: 466 },
  { id: 'gpu_hdmi', kind: 'connector', x: 240, y: 392 }, { id: 'monitor_hdmi', kind: 'connector', x: 867, y: 191 },
  { id: 'mb_vga', kind: 'connector', x: 240, y: 313 }, { id: 'monitor_vga', kind: 'connector', x: 867, y: 229 },
  { id: 'vrm', kind: 'inspect', x: 357, y: 136 }, { id: 'chipset', kind: 'inspect', x: 647, y: 466 },
  { id: 'cmos', kind: 'inspect', x: 602, y: 516 }, { id: 'usb_header', kind: 'inspect', x: 692, y: 540 },
  { id: 'audio_header', kind: 'inspect', x: 364, y: 540 }, { id: 'rear_io', kind: 'inspect', x: 252, y: 277 },
]

const selection = ref<Selection>(null)
const focused = ref<string | null>(null)
const lastActionSpot = ref<string | null>(null)
const gestureError = ref<string | null>(null)
const toolSelected = ref(false)
const cablePreview = ref<{ cable: CableId; connector: string; point: { x: number; y: number } } | null>(null)
const zoom = ref(1)
const closeButton = ref<HTMLButtonElement | null>(null)
const inspectionCard = ref<HTMLElement | null>(null)
const inspectionStyle = ref<Record<string, string>>({})
let previousOverflow = ''
onMounted(() => {
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  closeButton.value?.focus()
  window.addEventListener('resize', positionInspection)
  window.addEventListener('scroll', positionInspection, true)
})
onUnmounted(() => {
  document.body.style.overflow = previousOverflow
  window.removeEventListener('resize', positionInspection)
  window.removeEventListener('scroll', positionInspection, true)
})
const cables = Object.keys(cableInfo) as CableId[]
const layout = (cable: CableId) => cableLayout(visualState.value, cable, cablePreview.value?.cable === cable ? cablePreview.value : undefined)
const compatibleConnectors = computed<string[]>(() => selection.value?.kind === 'cable' ? [...cableInfo[selection.value.id as CableId].ends] : [])
const nextCableEnd = computed(() => selection.value?.kind === 'cable'
  ? cableInfo[selection.value.id as CableId].ends.find(end => !props.state.connections[selection.value!.id as CableId].includes(end)) : null)
const compatibleSlots = computed(() => selection.value?.kind === 'part'
  ? (Object.keys(slotInfo) as SlotId[]).filter(slot => slotInfo[slot].accepts.includes(selection.value!.id as PartId)) : [])
type SceneHighlight = { key: string; kind: 'hotspot' | 'empty-slot' | 'installed' | 'object' | 'loose'; x: number; y: number; id?: string; width?: number; height?: number }
const sceneHighlights = computed(() => {
  const highlights = new Map<string, SceneHighlight>()
  const addLoose = (index: number) => {
    const part = props.state.inventory[index]
    const position = props.state.loosePositions[index]
    if (!part || !position || props.state.looseLocations[index] !== 'table' || dragView.value?.target.kind === 'part' && dragView.value.target.index === index) return
    highlights.set(`loose-${index}`, { key: `loose-${index}`, kind: 'loose', id: part, ...position })
  }
  if (selection.value?.kind === 'cable') {
    for (const end of layout(selection.value.id as CableId).ends) highlights.set(`connector-${end.connector}`, { key: `connector-${end.connector}`, kind: 'hotspot', ...end.point })
  } else if (selection.value?.kind === 'part' && selection.value.index !== undefined) addLoose(selection.value.index)
  const id = focused.value
  if (id?.startsWith('loose:')) addLoose(Number(id.slice(6)))
  else if (id && id in slotInfo) {
    const slot = id as SlotId
    if (props.state.parts[slot]) {
      if (!(dragView.value?.target.kind === 'part' && drag?.release?.type === 'remove' && drag.release.slot === slot)) {
        highlights.set(`slot-${slot}`, { key: `slot-${slot}`, kind: 'installed', ...spritePoint(slot), ...partSize[slot] })
      }
    } else highlights.set(`slot-${slot}`, { key: `slot-${slot}`, kind: 'empty-slot', ...point(slot) })
  } else if (id && id in visualObjects.value) highlights.set(`object-${id}`, { key: `object-${id}`, kind: 'object', id, ...visualObjects.value[id as keyof HardwareState['objects']] })
  else if (id && id in controlInfo) highlights.set(`control-${id}`, { key: `control-${id}`, kind: 'hotspot', ...controlPoint(id) })
  else if (id && !highlights.has(`connector-${id}`) && hotspots.some(item => item.id === id)) highlights.set(`hotspot-${id}`, { key: `hotspot-${id}`, kind: 'hotspot', ...point(id) })
  return [...highlights.values()]
})
const objectDetails: Record<keyof HardwareState['objects'], string> = {
  motherboard: 'Placa principal que reúne os encaixes e conectores da máquina.',
  psu: 'Fornece energia aos componentes por meio dos cabos internos.',
  ssd: 'Baia que acompanha a unidade SATA e suas entradas DATA e POWER.',
  monitor: 'Recebe o sinal de vídeo pelos conectores HDMI ou VGA.',
}
const inspection = computed(() => {
  if (focused.value && focused.value in slotInfo) {
    const slot = focused.value as SlotId
    const part = props.state.parts[slot]
    return part
      ? { name: partInfo[part].name, detail: partInfo[part].detail, context: `Instalada em ${slotInfo[slot].name} · ${slotInfo[slot].detail}` }
      : { name: slotInfo[slot].name, detail: slotInfo[slot].detail, context: 'Encaixe vazio' }
  }
  if (focused.value && focused.value in objectDetails) {
    const id = focused.value as keyof HardwareState['objects']
    const current = props.state.objects[id]
    const preset = id === 'motherboard' ? null : objectPositions[id].find(position => Math.hypot(position.point.x - current.x, position.point.y - current.y) < 2)
    return { name: objectNames[id], detail: objectDetails[id], context: id === 'motherboard' ? 'Montada no gabinete' : preset?.name ?? 'Posição livre na bancada' }
  }
  if (focused.value && focused.value in controlInfo) return { ...controlInfo[focused.value], context: 'Controle na máquina' }
  if (focused.value && connectorInfo[focused.value]) return { ...connectorInfo[focused.value], context: focused.value === 'mb_pwr_sw' ? props.state.connections.front_panel.includes('mb_pwr_sw') ? 'Pinos ocupados pelo cabo do botão' : 'Pinos livres para a chave de fenda' : 'Conector ou ponto de inspeção' }
  if (focused.value?.startsWith('loose:')) {
    const index = Number(focused.value.slice(6))
    const part = props.state.inventory[index]
    if (part) return { ...partInfo[part], context: props.state.looseLocations[index] === 'tray' ? 'Peça solta na bandeja' : 'Peça solta na bancada' }
  }
  if (selection.value) {
    const selected = selection.value
    const info = selected.kind === 'part' ? partInfo[selected.id as PartId] : cableInfo[selected.id as CableId]
    const location = selected.kind === 'part' && selected.index !== undefined ? props.state.looseLocations[selected.index] : null
    return { ...info, context: selected.kind === 'cable' ? 'Cabo selecionado' : location === 'tray' ? 'Peça solta na bandeja' : location === 'table' ? 'Peça solta na bancada' : 'Peça solta' }
  }
  return null
})
watch(() => props.state, state => {
  if (selection.value?.kind === 'part' && (selection.value.index === undefined ? !state.inventory.includes(selection.value.id as PartId) : state.inventory[selection.value.index] !== selection.value.id)) selection.value = null
})
watch([focused, selection, zoom, visualObjects, () => props.state], () => nextTick(positionInspection), { flush: 'post' })

function positionInspection() {
  const card = inspectionCard.value
  if (!card || !inspection.value) return
  const targets = [...document.querySelectorAll<HTMLElement>('[data-inspect]')].filter(el => el.getClientRects().length)
  let anchor = focused.value ? targets.find(el => el.dataset.inspect === focused.value) : null
  if (!anchor) anchor = targets.find(el => el.classList.contains('chosen') || el.classList.contains('active'))
  if (!anchor) anchor = document.querySelector<HTMLElement>('.mobile-toolbelt select') ?? viewport.value
  if (!anchor) return
  let rect = anchor.getBoundingClientRect()
  if (rect.bottom < 0 || rect.top > innerHeight || rect.right < 0 || rect.left > innerWidth) rect = (document.querySelector<HTMLElement>('.mobile-toolbelt select') ?? viewport.value ?? anchor).getBoundingClientRect()
  const width = card.offsetWidth, height = card.offsetHeight, gap = 12
  let left = rect.right + gap
  let top = rect.top
  if (left + width > innerWidth - gap) left = rect.left - width - gap
  if (left < gap) {
    left = Math.max(gap, Math.min(rect.left, innerWidth - width - gap))
    top = rect.bottom + gap
  }
  if (top + height > innerHeight - gap) top = rect.top - height - gap
  inspectionStyle.value = { left: `${Math.max(gap, Math.min(left, innerWidth - width - gap))}px`, top: `${Math.max(gap, Math.min(top, innerHeight - height - gap))}px` }
}

function point(id: string) {
  const hotspot = hotspots.find(item => item.id === id)
  if (!hotspot) return { x: 0, y: 0 }
  if (hotspot.kind === 'connector') return cablePoint(id, visualObjects.value)
  if (id.startsWith('psu_')) return { x: hotspot.x + offset('psu').x, y: hotspot.y + offset('psu').y }
  if (id.startsWith('disk_') || id === 'sata_bay') return { x: hotspot.x + offset('ssd').x, y: hotspot.y + offset('ssd').y }
  if (id.startsWith('monitor_')) return { x: hotspot.x + offset('monitor').x, y: hotspot.y + offset('monitor').y }
  return id.startsWith('mb_') || ['cpu', 'cooler', 'dimm_a2', 'dimm_b2', 'pcie_x16', 'm2', 'vrm', 'chipset', 'cmos', 'usb_header', 'audio_header', 'rear_io'].includes(id)
    ? { x: hotspot.x + boardOffset.x, y: hotspot.y + boardOffset.y } : hotspot
}
function spritePoint(slot: SlotId) {
  const sprite = slotGeometry[slot].sprite
  const displacement = slot === 'sata_bay' ? offset('ssd') : slot === 'front_button' ? { x: 0, y: 0 } : boardOffset
  return { x: sprite.x + displacement.x, y: sprite.y + displacement.y }
}
function controlPoint(id: string) {
  const psu = offset('psu')
  const points: Record<string, { x: number; y: number }> = {
    stabilizer: { x: 165, y: 585 },
    psuSwitch: { x: 65 + psu.x, y: 168 + psu.y },
    voltage: { x: 170 + psu.x, y: 168 + psu.y },
  }
  return points[id]
}
function compatibleDropSlot(part: PartId, position: { x: number; y: number }): SlotId | null {
  return (Object.keys(slotInfo) as SlotId[]).find(slot => slotInfo[slot].accepts.includes(part) && slotDropDistance(slot, position, point(slot)) < 32) ?? null
}

function scenePoint(event: PointerEvent) {
  const rect = scene.value!.getBoundingClientRect()
  return { x: Math.max(0, Math.min(SCENE_WIDTH, (event.clientX - rect.left) / rect.width * SCENE_WIDTH)), y: Math.max(0, Math.min(700, (event.clientY - rect.top) / rect.height * 700)) }
}
function beginDrag(event: PointerEvent, target: DragTarget, origin: { x: number; y: number }, release?: HardwareAction) {
  if (props.ready || !scene.value || drag) return
  event.preventDefault()
  const at = scenePoint(event)
  const rect = scene.value.getBoundingClientRect()
  const fromTray = (event.currentTarget as HTMLElement).closest('.part-tray') !== null
  drag = { pointerId: event.pointerId, target, dx: fromTray || target.kind === 'tool' ? 0 : origin.x - at.x, dy: fromTray || target.kind === 'tool' ? 0 : origin.y - at.y, clientDx: fromTray ? 0 : rect.left + origin.x / SCENE_WIDTH * rect.width - event.clientX, clientDy: fromTray ? 0 : rect.top + origin.y / 700 * rect.height - event.clientY, startX: event.clientX, startY: event.clientY, moved: false, x: origin.x, y: origin.y, release }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
function beginInstalledPart(event: PointerEvent, slot: SlotId) {
  const part = props.state.parts[slot]
  if (!part || props.ready) return
  if (slot === 'sata_bay') {
    beginDrag(event, { kind: 'object', id: 'ssd' }, props.state.objects.ssd)
    return
  }
  const index = props.state.inventory.length
  beginDrag(event, { kind: 'part', index }, spritePoint(slot), { type: 'remove', slot })
}
function beginCableDrag(event: PointerEvent, cable: CableId, connector: string) {
  if (connector === 'mb_pwr_sw' && toolSelected.value) return
  const end = layout(cable).ends.find(item => item.connector === connector)!
  beginDrag(event, { kind: 'cable', id: cable, connector }, end.point)
}
function movePointer(event: PointerEvent) {
  if (!drag || drag.pointerId !== event.pointerId) return
  const at = scenePoint(event)
  const x = Math.round(Math.max(0, Math.min(SCENE_WIDTH, at.x + drag.dx)))
  const y = Math.round(Math.max(0, Math.min(700, at.y + drag.dy)))
  if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < (drag.moved ? 2 : 5)) return
  drag.moved = true
  const target = drag.target
  const position = target.kind === 'object'
    ? resolveObjectPosition(target.id, { x, y }, props.state.objects)
    : target.kind === 'cable' ? avoidPhysicalControls({ x, y }, props.state.objects) : { x, y }
  drag.x = position.x; drag.y = position.y
  dragView.value = { target, ...position, clientX: event.clientX + drag.clientDx, clientY: event.clientY + drag.clientDy }
  if (target.kind === 'object') {
    movingObject.value = target.id
    proposedPosition.value = position
  }
  if (target.kind === 'cable') cablePreview.value = { cable: target.id, connector: target.connector, point: position }
}
async function finishPointer(event: PointerEvent, cancelled = false) {
  if (!drag || drag.pointerId !== event.pointerId) return
  const { target, moved, x, y, release } = drag
  const inTray = !!tray.value && (() => { const rect = tray.value!.getBoundingClientRect(); return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom })()
  drag = null
  dragView.value = null
  movingObject.value = null
  proposedPosition.value = null
  cablePreview.value = null
  if (!moved) return
  suppressClick = true
  setTimeout(() => { suppressClick = false }, 0)
  await nextTick()
  const draggedPartId = target.kind === 'part' ? release?.type === 'remove' ? props.state.parts[release.slot] : props.state.inventory[target.index] : null
  const nearest = cancelled || !draggedPartId ? null : compatibleDropSlot(draggedPartId, { x, y })
  if (cancelled) return
  if (target.kind === 'tool') {
    focused.value = 'mb_pwr_sw'
    lastActionSpot.value = 'mb_pwr_sw'
    if (Math.hypot(x - point('mb_pwr_sw').x, y - point('mb_pwr_sw').y) < 34) { toolSelected.value = false; gestureError.value = null; emit('action', { type: 'pressPower', method: 'bridge' }) }
    else gestureError.value = 'Encoste a ponta da chave nos dois pinos PWR_SW.'
    return
  }
  if (target.kind === 'object') moveObject(target.id, { x, y })
  if (target.kind === 'part') {
    let part = props.state.inventory[target.index]
    let index = target.index
    if (release?.type === 'remove') {
      part = props.state.parts[release.slot]!
      if (!part || (nearest === release.slot && !inTray)) return
      emit('action', release)
      await nextTick()
      if (props.state.parts[release.slot]) return
      index = props.state.inventory.length - 1
    }
    if (part && nearest && !inTray && slotInfo[nearest].accepts.includes(part)) emit('action', { type: 'install', part, slot: nearest, index })
    else if (part) emit('action', { type: 'moveLoose', index, x, y, location: inTray ? 'tray' : 'table' })
  }
  if (target.kind === 'cable' && !cancelled) {
    const near = hotspots.find(spot => spot.kind === 'connector' && Math.hypot(point(spot.id).x - x, point(spot.id).y - y) < 32)
    choose('cable', target.id, true)
    if (near) {
      focused.value = near.id
      lastActionSpot.value = near.id
      if (near.id !== target.connector && cableInfo[target.id].ends.includes(near.id)) {
        gestureError.value = `Esta ponta pertence a ${connectorInfo[target.connector].name}. Arraste-a até essa porta.`
      } else if (near.id !== target.connector) {
        gestureError.value = null
        emit('action', { type: 'connect', cable: target.id, connector: near.id })
      } else if (near.id === target.connector && props.state.connections[target.id].includes(target.connector)) {
        return
      } else {
        gestureError.value = null
        emit('action', { type: 'connect', cable: target.id, connector: near.id })
      }
    } else {
      if (props.state.connections[target.id].includes(target.connector)) emit('action', { type: 'disconnectEnd', cable: target.id, connector: target.connector })
      emit('action', { type: 'moveCableEnd', cable: target.id, connector: target.connector, x, y })
    }
  }
}

function moveObject(object: MovableObject, point: { x: number; y: number }) {
  emit('action', { type: 'moveObject', object, ...resolveObjectPosition(object, point, props.state.objects) })
}
function moveObjectByKey(event: KeyboardEvent, object: MovableObject) {
  const directions: Record<string, { x: number; y: number }> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } }
  const direction = directions[event.key]
  if (!direction || props.ready) return
  event.preventDefault()
  event.stopPropagation()
  const step = event.shiftKey ? 5 : 20
  const current = props.state.objects[object]
  moveObject(object, { x: current.x + direction.x * step, y: current.y + direction.y * step })
}

function hotspotLabel(hotspot: Hotspot) {
  const label = hotspot.kind === 'slot' ? slotInfo[hotspot.id as SlotId].name : connectorInfo[hotspot.id].name
  const installed = hotspot.kind === 'slot' ? props.state.parts[hotspot.id as SlotId] : null
  return installed ? `${label}: ${partInfo[installed].name}` : hotspot.id === 'mb_pwr_sw' ? `${label}: ${props.state.connections.front_panel.includes('mb_pwr_sw') ? 'ocupados pelo cabo do botão' : 'livres para a chave de fenda'}` : label
}

function useHotspot(hotspot: Hotspot) {
  if (suppressClick) { suppressClick = false; return }
  focused.value = hotspot.id
  gestureError.value = null
  if (props.ready) return
  if (hotspot.id === 'mb_pwr_sw' && toolSelected.value) { toolSelected.value = false; lastActionSpot.value = 'mb_pwr_sw'; emit('action', { type: 'pressPower', method: 'bridge' }); return }
  if (hotspot.id === 'front_button' && props.state.parts.front_button) { emit('action', { type: 'pressPower', method: 'button' }); return }
  if (!selection.value) return
  if (selection.value.kind === 'part' && hotspot.kind === 'slot' && !props.state.parts[hotspot.id as SlotId]) {
    lastActionSpot.value = hotspot.id
    emit('action', { type: 'install', part: selection.value.id as PartId, slot: hotspot.id as SlotId })
  } else if (selection.value.kind === 'cable' && hotspot.kind === 'connector') {
    lastActionSpot.value = hotspot.id
    emit('action', { type: 'connect', cable: selection.value.id as CableId, connector: hotspot.id })
  }
}

function clearSelection() {
  toolSelected.value = false
  selection.value = null
  focused.value = null
  lastActionSpot.value = null
  gestureError.value = null
}
function chooseTool() {
  if (suppressClick) { suppressClick = false; return }
  selection.value = null
  toolSelected.value = !toolSelected.value
  focused.value = toolSelected.value ? 'mb_pwr_sw' : null
  gestureError.value = null
}
function choose(kind: 'part' | 'cable', id: string, force = false, index?: number) {
  toolSelected.value = false
  if (!force && selection.value?.kind === kind && selection.value.id === id && selection.value.index === index) {
    clearSelection()
    return
  }
  selection.value = { kind, id, index }
  focused.value = null
  lastActionSpot.value = null
  gestureError.value = null
}
function chooseCableEnd(cable: CableId, connector: string) {
  if (suppressClick) { suppressClick = false; return }
  if (connector === 'mb_pwr_sw' && toolSelected.value) { toolSelected.value = false; focused.value = connector; lastActionSpot.value = connector; emit('action', { type: 'pressPower', method: 'bridge' }); return }
  choose('cable', cable)
  if (selection.value?.kind === 'cable') focused.value = connector
}
function focusLoosePart(index: number) {
  focused.value = `loose:${index}`
}
function onSceneClick(event: MouseEvent) {
  if (suppressClick) { suppressClick = false; return }
  if (event.target instanceof Element && event.target.closest('button, .cable-art')) return
  clearSelection()
}
function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || (!selection.value && !focused.value)) return
  event.stopPropagation()
  clearSelection()
}

function chooseFromSelect(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (!value) {
    clearSelection()
    return
  }
  const [kind, id] = value.split(':')
  choose(kind as 'part' | 'cable', id)
}

function removeFocused() {
  if (!focused.value || !(focused.value in slotInfo)) return
  lastActionSpot.value = focused.value
  emit('action', { type: 'remove', slot: focused.value as SlotId })
}

function changeZoom(amount: number) {
  zoom.value = Math.max(1, Math.min(2, Math.round((zoom.value + amount) * 2) / 2))
}
function goToRegion(x: number) {
  if (!viewport.value) return
  viewport.value.scrollTo({ left: viewport.value.scrollWidth * x - viewport.value.clientWidth / 2, behavior: 'smooth' })
}
</script>

<template>
  <div class="workbench-backdrop" role="dialog" aria-modal="true" :aria-label="`Bancada de hardware: ${hardwareCases[caseId].title}`" @keydown="onKeydown" @pointermove="movePointer" @pointerup="finishPointer($event)" @pointercancel="finishPointer($event, true)">
    <div class="workbench">
      <header class="workbench-header">
        <div><span class="workbench-kicker">BANCADA DE DIAGNÓSTICO · MODELO FICTÍCIO</span><h2>{{ hardwareCases[caseId].title }}</h2><p>{{ hardwareCases[caseId].symptom }}</p></div>
        <button ref="closeButton" class="workbench-close" aria-label="Fechar bancada" @click="emit('close')">Fechar <span aria-hidden="true">×</span></button>
      </header>
      <div class="workbench-layout">
        <section class="workbench-main" aria-label="Máquina em análise">
          <div class="workbench-toolbar"><span>PLACA ATX · SÉRIE 2010 <small>Selecione para inspecionar · escolha peça ou cabo para encaixar</small></span><div class="zoom-controls"><button aria-label="Diminuir zoom" :disabled="zoom === 1" @click="changeZoom(-0.5)">−</button><output>{{ Math.round(zoom * 100) }}%</output><button aria-label="Aumentar zoom" :disabled="zoom === 2" @click="changeZoom(0.5)">+</button></div></div>
          <div class="mobile-toolbelt"><label>PEÇA OU CABO<select :value="selection ? `${selection.kind}:${selection.id}` : ''" :disabled="ready" @change="chooseFromSelect"><option value="">Selecione um item</option><optgroup label="Peças"><option v-for="part in state.inventory" :key="part" :value="`part:${part}`">{{ partInfo[part].name }}</option></optgroup><optgroup label="Cabos"><option v-for="cable in cables" :key="cable" :value="`cable:${cable}`">{{ cableInfo[cable].name }} · {{ state.connections[cable].length }}/2</option></optgroup></select></label></div>
          <nav class="region-controls" aria-label="Regiões da bancada"><button @click="goToRegion(0.14)">Fonte</button><button @click="goToRegion(0.39)">Placa-mãe</button><button @click="goToRegion(0.7)">Monitor e SSD</button><button @click="goToRegion(0.87)">Ferramenta</button></nav>
          <div v-if="moveTarget" class="move-preview" role="status">Destino: {{ moveTarget.name }} · {{ movePreview.length ? movePreview.map(item => `${cableInfo[item.cable].name} ${item.status === 'broken' ? 'romperia' : 'ficaria tensionado'}`).join('; ') : 'cabos sem tensão prevista' }}</div>
          <div ref="viewport" class="workbench-viewport">
            <div ref="scene" class="workbench-scene" :style="{ width: `${zoom * 1400 / 1100 * 100}%`, minWidth: `${980 * zoom}px` }" @click="onSceneClick">
              <svg class="board-art" viewBox="0 0 1400 700" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <defs><pattern id="board-traces" width="38" height="38" patternUnits="userSpaceOnUse"><path d="M0 19h19v19 M19 0v19h19 M7 7h17m-7 0v10" fill="none" stroke="#5c8b68" stroke-width="1.5" opacity=".38"/></pattern><pattern id="metal-brush" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0 1h5" stroke="#8da29b" opacity=".23"/></pattern></defs>
                <rect width="1400" height="700" fill="#183038"/>
                <path d="M0 570h1400M0 350h220M850 350h250" stroke="#3b5960" stroke-width="4"/>
                <g :transform="`translate(${offset('psu').x} ${offset('psu').y})`"><text x="40" y="97" class="diagram-label">FONTE ATX</text><rect x="35" y="151" width="160" height="160" rx="4" fill="#75847f" stroke="#b9c9bb" stroke-width="5"/><rect x="40" y="156" width="150" height="150" fill="url(#metal-brush)"/><rect x="48" y="174" width="112" height="107" fill="#28383b" stroke="#a8b7ae" stroke-width="3"/><circle cx="104" cy="226" r="49" fill="#1c2d31" stroke="#c4d0c0" stroke-width="4"/><circle cx="104" cy="226" r="37" fill="#344c4a" stroke="#829e91" stroke-width="2"/><path d="M104 190c19 0 22 17 8 27M139 226c0 19-17 22-27 8M104 262c-19 0-22-17-8-27M69 226c0-19 17-22 27-8" fill="none" stroke="#779a8a" stroke-width="10" stroke-linecap="round"/><circle cx="104" cy="226" r="9" fill="#c5d1bd"/><circle cx="45" cy="161" r="3" fill="#e1dcc8"/><circle cx="185" cy="161" r="3" fill="#e1dcc8"/><circle cx="45" cy="300" r="3" fill="#e1dcc8"/><circle cx="185" cy="300" r="3" fill="#e1dcc8"/><path d="M57 294h95" stroke="#3d4f50" stroke-width="2"/><rect x="78" y="290" width="54" height="20" fill="#1b2f34" stroke="#d1d6c6" stroke-width="3"/><text x="139" y="292" class="tiny-label">AC</text><text x="132" y="183" class="tiny-label">ATX</text></g>
                <path d="M211 68H822V590H890V686H211Z" fill="#213a3e" stroke="#7c9691" stroke-width="5"/><text x="235" y="603" class="tiny-label">GABINETE ABERTO · PLACA ATX MONTADA</text>
                <g :transform="`translate(${boardOffset.x} ${boardOffset.y})`"><text x="263" y="65" class="diagram-label">PLACA-MÃE · ATX 2010</text><rect x="225" y="95" width="585" height="470" rx="4" fill="#254a39" stroke="#9aaf98" stroke-width="6"/><rect x="236" y="106" width="563" height="448" fill="url(#board-traces)"/><path d="M270 152h484M275 345h469M278 510h458" stroke="#5a8c69" stroke-width="2" opacity=".75"/><g fill="#142e2c" stroke="#cad2b5" stroke-width="3"><circle cx="248" cy="117" r="9"/><circle cx="790" cy="117" r="9"/><circle cx="248" cy="543" r="9"/><circle cx="790" cy="543" r="9"/></g><g fill="#d4c89d"><circle cx="248" cy="117" r="3"/><circle cx="790" cy="117" r="3"/><circle cx="248" cy="543" r="3"/><circle cx="790" cy="543" r="3"/></g>
                <rect x="217" y="179" width="42" height="155" fill="#a9b5a9" stroke="#243d3b" stroke-width="4"/><circle cx="237" cy="205" r="11" fill="#515d79" stroke="#d7d7c8" stroke-width="2"/><rect x="226" y="231" width="24" height="17" fill="#223a40" stroke="#d8d9ca" stroke-width="2"/><rect x="226" y="257" width="24" height="17" fill="#223a40" stroke="#d8d9ca" stroke-width="2"/><rect x="226" y="283" width="24" height="17" fill="#223a40" stroke="#d8d9ca" stroke-width="2"/><text x="266" y="322" class="tiny-label">I/O</text>
                <rect x="217" y="365" width="42" height="55" fill="#566b6b" stroke="#142f37" stroke-width="4"/><text x="263" y="401" class="tiny-label">GPU</text>
                <g fill="#a4aa8d" stroke="#52675b" stroke-width="2"><rect x="352" y="113" width="22" height="34"/><rect x="381" y="113" width="22" height="34"/><rect x="410" y="113" width="22" height="34"/><rect x="439" y="113" width="22" height="34"/><rect x="320" y="174" width="22" height="34"/><rect x="320" y="216" width="22" height="34"/><rect x="320" y="258" width="22" height="34"/></g><g fill="#c2c9b3"><circle cx="475" cy="126" r="7"/><circle cx="496" cy="126" r="7"/><circle cx="338" cy="320" r="7"/><circle cx="358" cy="320" r="7"/></g><text x="351" y="160" class="tiny-label">VRM</text>
                <rect x="365" y="164" width="140" height="132" fill="#c5cbb8" stroke="#233933" stroke-width="7"/><rect x="380" y="179" width="110" height="102" fill="#496a59" stroke="#a9bca1" stroke-width="3"/><path d="M505 170v119l18 12" fill="none" stroke="#d3d6c5" stroke-width="5"/><text x="401" y="235" class="diagram-label">CPU</text>
                <rect x="558.5" y="140" width="30" height="207" fill="#182d33" stroke="#afc3ae" stroke-width="3"/><rect x="606.5" y="140" width="30" height="207" fill="#182d33" stroke="#afc3ae" stroke-width="3"/><path d="M559 137v-12h29v12m-29 211v11h29v-11m19-211v-12h29v12m-29 211v11h29v-11" fill="#d4d2bd" stroke="#345147" stroke-width="2"/><text x="545" y="370" class="tiny-label">DIMM_A2</text><text x="595" y="386" class="tiny-label">DIMM_B2</text>
                <rect x="320" y="378" width="375" height="30" fill="#172e33" stroke="#d3b976" stroke-width="4"/><rect x="677" y="375" width="18" height="36" fill="#c8cdbc" stroke="#38534b" stroke-width="2"/><path d="M430 381v24" stroke="#b7bba6" stroke-width="7"/><text x="425" y="429" class="tiny-label">PCIe x16</text>
                <rect x="500" y="456" width="116" height="21" fill="#162e34" stroke="#d0b574" stroke-width="3"/><circle cx="607" cy="466" r="4" fill="#d4ccae"/><text x="518" y="496" class="tiny-label">M.2</text><circle cx="590" cy="517" r="17" fill="#d4d2bb" stroke="#263737" stroke-width="4"/><rect x="621" y="451" width="58" height="42" rx="2" fill="#7f8f80" stroke="#bcc8af" stroke-width="3"/><path d="M627 459h46m-46 8h46m-46 8h46m-46 8h46" stroke="#4b6a5a" stroke-width="2"/><text x="636" y="510" class="tiny-label">CHIPSET</text>
                <rect x="745" y="189" width="28" height="86" fill="#172e34" stroke="#d2c188" stroke-width="3"/><text x="694" y="185" class="tiny-label">ATX 24</text><rect x="265" y="111" width="42" height="28" fill="#172e34" stroke="#d2c188" stroke-width="3"/><text x="308" y="130" class="tiny-label">EPS</text>
                <rect x="737" y="432" width="45" height="18" fill="#142d34" stroke="#d2b875" stroke-width="3"/><rect x="737" y="456" width="45" height="18" fill="#142d34" stroke="#d2b875" stroke-width="3"/><text x="691" y="427" class="tiny-label">SATA</text><rect x="710" y="525" width="62" height="22" fill="#162d33" stroke="#d6bb79" stroke-width="3"/><text x="667" y="560" class="tiny-label">F_PANEL</text><rect x="668" y="550" width="25" height="13" fill="#102b2e" stroke="#e8c87e" stroke-width="2"/><circle cx="674" cy="556" r="2.5" fill="#e8c87e"/><circle cx="687" cy="556" r="2.5" fill="#e8c87e"/></g>
                <g :transform="`translate(${offset('monitor').x} ${offset('monitor').y})`"><text x="874" y="75" class="diagram-label">MONITOR LCD</text><rect x="867" y="95" width="197" height="151" rx="5" fill="#424f52" stroke="#abb9ac" stroke-width="5"/><rect x="876" y="104" width="179" height="118" :fill="state.lastTest?.code === 'boot_ok' ? '#285145' : '#294c58'" stroke="#172b30" stroke-width="3"/><path d="M883 109h165l-38 105h-127" fill="#d5e0d4" opacity=".05"/><rect x="877" y="225" width="177" height="13" fill="#273a3e"/><text x="887" y="236" class="tiny-label">ESCOLA</text><circle cx="1040" cy="231" r="3" :fill="state.powered ? '#9cdeb0' : '#efc271'"/><path d="M965 246v36m-50 3h100" stroke="#8ba9a3" stroke-width="8" stroke-linecap="round"/><text x="902" y="168" class="screen-label">{{ state.lastTest?.code === 'boot_ok' ? 'IMAGEM OK' : state.lastTest?.code === 'video_missing' ? 'SEM SINAL' : 'AGUARDANDO' }}</text></g>
                <g :transform="`translate(${offset('ssd').x} ${offset('ssd').y})`"><text x="897" y="375" class="diagram-label">BAIA SATA</text><rect x="885" y="391" width="167" height="116" rx="6" fill="#263c42" stroke="#9eb9a8" stroke-width="5" stroke-dasharray="10 6"/></g>
                <text x="42" y="551" class="diagram-label">ESTABILIZADOR</text><rect x="45" y="563" width="168" height="94" fill="#c6d2bb" stroke="#536d68" stroke-width="5"/><circle cx="74" cy="604" r="7" fill="#385057"/><circle cx="104" cy="604" r="7" fill="#385057"/><circle cx="177" cy="581" r="6" :fill="state.stabilizerOn ? '#9cdeb0' : '#a97665'"/>
                <text x="800" y="596" class="tiny-label">PAINEL FRONTAL</text><rect x="790" y="604" width="89" height="74" rx="3" fill="#345158" stroke="#9bb2a3" stroke-width="4"/><path d="M767 649h20" stroke="#8da99a" stroke-width="5"/><text x="1120" y="84" class="diagram-label">ÁREA LIVRE</text><path d="M1100 94h255M1100 570h255" stroke="#48615a" stroke-width="3"/>
              </svg>
              <svg class="cable-hit-art" viewBox="0 0 1400 700" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <g v-for="cable in cables" :key="`hit-${cable}`" class="cable-art" @click="choose('cable', cable)"><path :d="layout(cable).path" class="cable-hit"/></g>
              </svg>
              <button v-for="slot in (Object.keys(slotInfo) as SlotId[])" v-show="state.parts[slot]" :key="`installed-${slot}`" class="installed-part" :class="[slot, { inspecting: focused === slot }]" :style="{ left: `${spritePoint(slot).x / 14}%`, top: `${spritePoint(slot).y / 7}%`, width: `${partSize[slot].width / 14}%`, height: `${partSize[slot].height / 7}%`, opacity: dragView?.target.kind === 'part' && drag?.release?.type === 'remove' && drag.release.slot === slot ? 0 : 1 }" :data-inspect="slot" :aria-label="state.parts[slot] ? `${partInfo[state.parts[slot]].name} instalado em ${slotInfo[slot].name}` : slotInfo[slot].name" :disabled="ready || !state.parts[slot]" @pointerdown="beginInstalledPart($event, slot)" @click="useHotspot(hotspots.find(item => item.id === slot)!)" @focus="focused = slot"><PartSprite v-if="state.parts[slot]" :part="state.parts[slot]" :vertical="slot === 'dimm_a2' || slot === 'dimm_b2'" /></button>
              <button class="object-target motherboard" :style="{ left: `${visualObjects.motherboard.x / 14}%`, top: `${visualObjects.motherboard.y / 7}%` }" data-inspect="motherboard" aria-label="Inspecionar placa-mãe montada no gabinete" @click="focused = 'motherboard'" @focus="focused = 'motherboard'"><span class="sr-only">Inspecionar placa-mãe</span></button>
              <button v-for="object in (['psu', 'ssd', 'monitor'] as const)" :key="object" class="object-target" :class="object" :style="{ left: `${visualObjects[object].x / 14}%`, top: `${visualObjects[object].y / 7}%` }" :data-inspect="object" :aria-label="`Mover ${objectNames[object]} com as setas`" :disabled="ready" @pointerdown="beginDrag($event, { kind: 'object', id: object }, state.objects[object])" @keydown="moveObjectByKey($event, object)" @click="focused = object" @focus="focused = object"><span class="sr-only">Mover {{ objectNames[object] }}</span></button>
              <button v-for="hotspot in hotspots" v-show="hotspot.kind !== 'slot' || !state.parts[hotspot.id as SlotId]" :key="hotspot.id" class="board-hotspot" :class="[hotspot.kind, { selected: focused === hotspot.id, compatible: compatibleConnectors.includes(hotspot.id) || (hotspot.kind === 'slot' && compatibleSlots.includes(hotspot.id as SlotId)), next: nextCableEnd === hotspot.id }]" :style="{ left: `${point(hotspot.id).x / 14}%`, top: `${point(hotspot.id).y / 7}%` }" :data-inspect="hotspot.id" :aria-label="hotspotLabel(hotspot)" :title="hotspotLabel(hotspot)" @click="useHotspot(hotspot)" @focus="focused = hotspot.id"><span class="sr-only">{{ hotspotLabel(hotspot) }}</span></button>
              <svg class="cable-visible-art" viewBox="0 0 1400 700" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <g v-for="cable in cables" :key="cable" class="cable-art" :class="{ active: selection?.kind === 'cable' && selection.id === cable, broken: state.cables[cable].condition === 'broken', tense: cableTension(cable) }"><path :d="layout(cable).path" class="cable-shadow"/><path :d="layout(cable).path" class="cable-wire"/></g>
                <g v-for="hotspot in hotspots.filter(item => item.kind === 'connector')" :key="`mark-${hotspot.id}`" class="connector-mark" :transform="`translate(${point(hotspot.id).x} ${point(hotspot.id).y})`"><rect x="-8" y="-7" width="16" height="14" rx="1"/><circle cx="-3" r="1.5"/><circle cx="3" r="1.5"/><text :x="point(hotspot.id).x > 800 ? -13 : 13" y="-10" :text-anchor="point(hotspot.id).x > 800 ? 'end' : 'start'">{{ hotspot.id.replace(/^(mb|psu|monitor|disk)_/, '').toUpperCase() }}</text></g>
              </svg>
              <template v-for="cable in cables" :key="`ends-${cable}`"><button v-for="(end, endIndex) in layout(cable).ends" :key="end.connector" class="cable-end" :class="{ loose: !end.connected, active: selection?.kind === 'cable' && selection.id === cable, focused: focused === end.connector, broken: state.cables[cable].condition === 'broken' }" :style="{ left: `${end.point.x / 14}%`, top: `${end.point.y / 7}%` }" :data-inspect="end.connector" :aria-label="`${cableInfo[cable].name}: ${connectorInfo[end.connector].name}, ${end.connected ? 'ligada' : 'solta'}. Clique para selecionar ou arraste a ponta.`" :title="`${cableInfo[cable].name} · ${connectorInfo[end.connector].name}`" :disabled="ready" @pointerdown="beginCableDrag($event, cable, end.connector)" @click="chooseCableEnd(cable, end.connector)" @focus="focused = end.connector"><span class="cable-tag" aria-hidden="true">{{ cable.toUpperCase().replace('_', ' ') }} {{ endIndex + 1 }}</span></button></template>
              <button class="physical-control stabilizer-control" :class="{ on: state.stabilizerOn }" :style="{ left: `${controlPoint('stabilizer').x / 14}%`, top: `${controlPoint('stabilizer').y / 7}%` }" data-inspect="stabilizer" :aria-label="`Estabilizador ${state.stabilizerOn ? 'ligado' : 'desligado'}; alternar chave`" :disabled="ready" @focus="focused = 'stabilizer'" @click="focused = 'stabilizer'; emit('action', { type: 'setStabilizer', on: !state.stabilizerOn })">{{ state.stabilizerOn ? 'I' : 'O' }}</button>
              <button class="physical-control psu-control" :class="{ on: state.psuOn }" :style="{ left: `${controlPoint('psuSwitch').x / 14}%`, top: `${controlPoint('psuSwitch').y / 7}%` }" data-inspect="psuSwitch" :aria-label="`Chave I/O da fonte ${state.psuOn ? 'ligada' : 'desligada'}; alternar`" :disabled="ready" @focus="focused = 'psuSwitch'" @click="focused = 'psuSwitch'; emit('action', { type: 'setPsu', on: !state.psuOn })">{{ state.psuOn ? 'I' : 'O' }}</button>
              <button v-if="state.psu.kind === 'manual'" class="physical-control voltage-control" :style="{ left: `${controlPoint('voltage').x / 14}%`, top: `${controlPoint('voltage').y / 7}%` }" data-inspect="voltage" :aria-label="`Seletor da fonte em ${state.psu.voltage} volts; alternar para ${state.psu.voltage === 127 ? 220 : 127} volts`" :disabled="ready" @focus="focused = 'voltage'" @click="focused = 'voltage'; emit('action', { type: 'setVoltage', voltage: state.psu.voltage === 127 ? 220 : 127 })">{{ state.psu.voltage }}V</button>
              <button class="screwdriver-tool" :class="{ selected: toolSelected }" :style="{ left: `${(dragView?.target.kind === 'tool' ? dragView.x : 1210) / 14}%`, top: `${(dragView?.target.kind === 'tool' ? dragView.y : 620) / 7}%` }" data-inspect="screwdriver" :aria-label="toolSelected ? 'Chave de fenda selecionada; encoste nos pinos PWR_SW' : 'Pegar chave de fenda; arraste aos pinos PWR_SW ou selecione e clique neles'" :aria-pressed="toolSelected" :disabled="ready" @pointerdown="beginDrag($event, { kind: 'tool' }, { x: 1210, y: 620 })" @click="chooseTool" @focus="focused = 'mb_pwr_sw'"><span aria-hidden="true">🪛</span><small>CHAVE DE FENDA</small></button>
              <div class="scene-highlights" aria-hidden="true"><span v-for="highlight in sceneHighlights" :key="highlight.key" class="scene-highlight" :class="[highlight.kind, highlight.id]" :style="{ left: `${highlight.x / 14}%`, top: `${highlight.y / 7}%`, ...(highlight.kind === 'installed' ? { width: `${highlight.width! / 14}%`, height: `${highlight.height! / 7}%` } : {}) }" /></div>
              <div v-if="lastActionSpot && focused === lastActionSpot" class="spot-feedback" :style="{ left: `${Math.min(80, point(lastActionSpot).x / 14)}%`, top: `${Math.max(8, point(lastActionSpot).y / 7 - 11)}%` }">{{ gestureError || state.feedback }}</div>
              <button v-for="(part, index) in state.inventory" v-show="state.looseLocations[index] === 'table'" :key="`loose-${index}`" class="loose-part" :class="[part, { chosen: selection?.kind === 'part' && selection.id === part && selection.index === index }]" :style="{ left: `${state.loosePositions[index].x / 14}%`, top: `${state.loosePositions[index].y / 7}%`, opacity: dragView?.target.kind === 'part' && dragView.target.index === index ? 0 : 1 }" :data-inspect="`loose:${index}`" :aria-label="`Inspecionar ${partInfo[part].name}`" @pointerdown="beginDrag($event, { kind: 'part', index }, state.loosePositions[index])" @click="suppressClick ? suppressClick = false : choose('part', part, false, index)" @focus="focusLoosePart(index)"><PartSprite :part="part" /></button>
            </div>
          </div>
          <div class="bench-status" role="status" aria-live="polite"><div><strong>OBJETIVO</strong><span>{{ hardwareCases[caseId].goal }}</span></div><div><strong>{{ ready ? 'CONCLUÍDO' : 'RESULTADO' }}</strong><span>{{ ready ? 'Feche a bancada e leve a solução à entrega.' : state.feedback }}</span><small v-if="state.lastTest && state.lastTest.text !== state.feedback">{{ state.lastTest.text }}</small></div></div>
          <div class="workbench-legend"><span>Acione as chaves e o botão frontal na máquina. Para usar a chave de fenda nos pinos PWR_SW, desligue a fonte, desconecte a alimentação e solte a ponta do cabo na placa. Arraste peças e cabos; mova fonte, SSD e monitor com as setas (Shift para ajuste fino).</span></div>
          <p class="workbench-disclaimer">Simulação com placa fictícia. Na manutenção real, consulte o manual do modelo e desligue e desconecte a alimentação antes de mexer nas peças.</p>
        </section>
        <aside class="workbench-sidebar" aria-label="Inventário e navegação">
          <details class="bench-inventory" open><summary class="bench-section-title">PEÇAS NA BANCADA</summary><p v-if="state.inventory.length === 0">Nenhuma peça solta. Reposições ficam no armário da sala.</p><div ref="tray" class="part-tray"><button v-for="(part, index) in state.inventory" v-show="state.looseLocations[index] === 'tray'" :key="`${part}-${index}`" :disabled="ready" :class="{ chosen: selection?.kind === 'part' && selection.id === part && selection.index === index }" :style="{ opacity: dragView?.target.kind === 'part' && dragView.target.index === index ? 0 : 1 }" :data-inspect="`loose:${index}`" :aria-label="`Inspecionar ${partInfo[part].name}`" @pointerdown="beginDrag($event, { kind: 'part', index }, state.loosePositions[index])" @click="suppressClick ? suppressClick = false : choose('part', part, false, index)" @focus="focusLoosePart(index)"><PartSprite :part="part" /><span>{{ partInfo[part].name }}</span></button></div></details>
          <div class="bench-footer"><button @click="emit('reset')">Reiniciar este caso</button><button @click="emit('close')">Voltar à sala</button></div>
        </aside>
      </div>
    </div>
    <div v-if="inspection" ref="inspectionCard" class="inspection-card" :class="{ placed: Object.keys(inspectionStyle).length > 0 }" :style="inspectionStyle" role="region" aria-label="Inspeção do item"><div class="inspection-card-head"><span>INSPEÇÃO</span><button type="button" aria-label="Fechar inspeção" @click="clearSelection">×</button></div><strong>{{ inspection.name }}</strong><p>{{ inspection.detail }}</p><small v-if="inspection.context">{{ inspection.context }}</small><p v-if="selection?.kind === 'cable'">{{ state.connections[selection.id as CableId].length }}/2 pontas ligadas. {{ nextCableEnd ? `Ligue ${connectorInfo[nextCableEnd].name} ou arraste a ponta.` : 'Cabo conectado.' }}</p><p v-else-if="selection?.kind === 'part'">Clique no encaixe compatível ou arraste a peça até ele.</p><button v-if="focused && focused in slotInfo && state.parts[focused as SlotId] && !ready" class="mini-action" @click="removeFocused">Remover peça</button><template v-if="selection?.kind === 'cable' && state.connections[selection.id as CableId].length && !ready"><button v-for="end in state.connections[selection.id as CableId]" :key="end" class="mini-action" @click="emit('action', { type: 'disconnectEnd', cable: selection.id as CableId, connector: end })">Soltar {{ connectorInfo[end].name }}</button><button class="mini-action" @click="emit('action', { type: 'disconnect', cable: selection.id as CableId })">Soltar cabo inteiro</button></template></div>
    <div v-if="dragView?.target.kind === 'part' && draggedPart" class="dragged-part" :class="[draggedPart, { highlighted: selection?.kind === 'part' && selection.index === dragView.target.index || drag?.release?.type === 'remove' && focused === drag.release.slot }]" :style="draggedSprite ?? { left: `${dragView.clientX}px`, top: `${dragView.clientY}px` }"><PartSprite :part="draggedPart" :vertical="draggedSlot === 'dimm_a2' || draggedSlot === 'dimm_b2'" /></div>
  </div>
</template>
