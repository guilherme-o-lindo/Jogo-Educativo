import { avoidPhysicalControls, cableDistance, cablePoint, cableTension } from './cableGeometry'
import { caseSetup, hardwareCases } from './cases'
import { powerAvailable, wrongVoltage } from './electrical'
export { hardwareCases } from './cases'

export type HardwareCaseId = 'power' | 'video' | 'storage' | 'psu' | 'voltage' | 'combined'
export type PartId = 'cpu_i5' | 'cooler_stock' | 'ram_good' | 'ram_faulty' | 'gpu' | 'ssd_sata_good' | 'ssd_sata_faulty' | 'button_good' | 'button_faulty' | 'ssd_m2'
export type SlotId = 'cpu' | 'cooler' | 'dimm_a2' | 'dimm_b2' | 'pcie_x16' | 'm2' | 'sata_bay' | 'front_button'
export type CableId = 'ac' | 'atx24' | 'eps8' | 'cpu_fan' | 'front_panel' | 'sata_data' | 'sata_power' | 'hdmi' | 'vga'
export type TestCode = 'no_power' | 'cpu_error' | 'dram_error' | 'video_missing' | 'storage_missing' | 'storage_fault' | 'boot_ok'
export const SCENE_WIDTH = 1400

export interface HardwareState {
  caseId: HardwareCaseId
  parts: Record<SlotId, PartId | null>
  inventory: PartId[]
  loosePositions: { x: number; y: number }[]
  looseLocations: ('tray' | 'table')[]
  connections: Record<CableId, string[]>
  cableEnds: Record<CableId, Record<string, { x: number; y: number }>>
  psuOn: boolean
  powered: boolean
  lastTest: { code: TestCode; text: string; method: 'button' | 'bridge' } | null
  feedback: string
  journal: string[]
  psu: { kind: 'automatic' | 'manual'; voltage: 127 | 220; supply: 127 | 220; failed: boolean }
  cables: Record<CableId, { length: number; condition: 'good' | 'broken' }>
  objects: Record<'motherboard' | 'psu' | 'ssd' | 'monitor', { x: number; y: number }>
  stabilizerOn: boolean
}

export type HardwareAction =
  | { type: 'install'; part: PartId; slot: SlotId; index?: number }
  | { type: 'remove'; slot: SlotId }
  | { type: 'connect'; cable: CableId; connector: string }
  | { type: 'disconnect'; cable: CableId }
  | { type: 'disconnectEnd'; cable: CableId; connector: string }
  | { type: 'moveCableEnd'; cable: CableId; connector: string; x: number; y: number; transient?: boolean }
  | { type: 'setPsu'; on: boolean }
  | { type: 'pressPower'; method: 'button' | 'bridge' }
  | { type: 'setVoltage'; voltage: 127 | 220 }
  | { type: 'replacePsu' }
  | { type: 'replaceCable'; cable: CableId }
  | { type: 'moveObject'; object: 'psu' | 'ssd' | 'monitor'; x: number; y: number; transient?: boolean }
  | { type: 'takePart'; part: PartId }
  | { type: 'moveLoose'; index: number; x: number; y: number; location?: 'tray' | 'table'; transient?: boolean }
  | { type: 'setStabilizer'; on: boolean }

export const partInfo: Record<PartId, { name: string; detail: string }> = {
  cpu_i5: { name: 'Processador', detail: 'Executa instruções. Este modelo fictício não fornece vídeo integrado.' },
  cooler_stock: { name: 'Cooler da CPU', detail: 'Dissipa o calor do processador e usa o header CPU_FAN.' },
  ram_good: { name: 'Módulo RAM funcional', detail: 'Memória testada para substituir um módulo suspeito.' },
  ram_faulty: { name: 'Módulo RAM com defeito', detail: 'Encaixa normalmente, mas impede a conclusão do POST.' },
  gpu: { name: 'Placa de vídeo', detail: 'Ocupa o PCIe x16 e oferece a saída HDMI ativa neste computador.' },
  ssd_sata_good: { name: 'SSD SATA funcional', detail: 'Precisa de cabo de dados e cabo de energia SATA.' },
  ssd_sata_faulty: { name: 'SSD SATA defeituoso', detail: 'Recebe energia, mas apresenta erro de leitura.' },
  button_good: { name: 'Botão frontal funcional', detail: 'Fecha momentaneamente os pinos PWR_SW para ligar a máquina.' },
  button_faulty: { name: 'Botão frontal defeituoso', detail: 'Não aciona os pinos PWR_SW mesmo com o cabo conectado.' },
  ssd_m2: { name: 'SSD M.2', detail: 'Unidade que se instala diretamente no slot M.2.' },
}

export const slotInfo: Record<SlotId, { name: string; detail: string; accepts: PartId[] }> = {
  cpu: { name: 'Socket da CPU', detail: 'Encaixe do processador. Observe a orientação antes da instalação.', accepts: ['cpu_i5'] },
  cooler: { name: 'Montagem do cooler', detail: 'Área sobre a CPU para fixação do dissipador.', accepts: ['cooler_stock'] },
  dimm_a2: { name: 'DIMM_A2', detail: 'Slot para módulo de memória RAM.', accepts: ['ram_good', 'ram_faulty'] },
  dimm_b2: { name: 'DIMM_B2', detail: 'Segundo slot de memória RAM.', accepts: ['ram_good', 'ram_faulty'] },
  pcie_x16: { name: 'PCIe x16', detail: 'Slot de expansão usado pela placa de vídeo.', accepts: ['gpu'] },
  m2: { name: 'M.2', detail: 'Slot de armazenamento direto na placa-mãe.', accepts: ['ssd_m2'] },
  sata_bay: { name: 'Baia do SSD SATA', detail: 'Local da unidade SATA, fora da placa-mãe.', accepts: ['ssd_sata_good', 'ssd_sata_faulty'] },
  front_button: { name: 'Botão do gabinete', detail: 'Botão físico ligado ao header F_PANEL / PWR_SW.', accepts: ['button_good', 'button_faulty'] },
}

export const cableInfo: Record<CableId, { name: string; ends: readonly [string, string]; detail: string }> = {
  ac: { name: 'Cabo de força', ends: ['wall_ac', 'psu_ac'], detail: 'Liga a tomada à entrada AC da fonte.' },
  atx24: { name: 'ATX 24 pinos', ends: ['psu_atx24', 'mb_atx24'], detail: 'Alimentação principal da placa-mãe.' },
  eps8: { name: 'EPS 8 pinos', ends: ['psu_eps8', 'mb_eps8'], detail: 'Alimentação do processador.' },
  cpu_fan: { name: 'Cabo CPU_FAN', ends: ['cooler_fan', 'mb_cpu_fan'], detail: 'Liga a ventoinha do cooler ao header CPU_FAN.' },
  front_panel: { name: 'Cabo do botão frontal', ends: ['case_button', 'mb_pwr_sw'], detail: 'Liga o botão do gabinete aos pinos PWR_SW.' },
  sata_data: { name: 'SATA de dados', ends: ['mb_sata1', 'disk_data'], detail: 'Transporta dados entre placa-mãe e SSD.' },
  sata_power: { name: 'SATA de energia', ends: ['psu_sata', 'disk_power'], detail: 'Alimenta a unidade SATA pela fonte.' },
  hdmi: { name: 'Cabo HDMI', ends: ['gpu_hdmi', 'monitor_hdmi'], detail: 'Leva o vídeo da GPU ao monitor.' },
  vga: { name: 'Cabo VGA', ends: ['mb_vga', 'monitor_vga'], detail: 'Neste caso, a saída da placa-mãe não gera vídeo sem GPU integrada na CPU.' },
}

export const connectorInfo: Record<string, { name: string; detail: string }> = {
  wall_ac: { name: 'Tomada', detail: 'Ponto de alimentação AC externo.' },
  psu_ac: { name: 'Entrada AC da fonte', detail: 'Recebe o cabo de força.' },
  psu_atx24: { name: 'Saída ATX 24 pinos', detail: 'Cabo principal da fonte para a placa.' },
  mb_atx24: { name: 'ATX_PWR 24 pinos', detail: 'Entrada principal de alimentação da placa-mãe.' },
  psu_eps8: { name: 'Saída EPS 8 pinos', detail: 'Cabo de energia da CPU vindo da fonte.' },
  mb_eps8: { name: 'CPU_PWR / EPS 8 pinos', detail: 'Entrada de alimentação do processador.' },
  cooler_fan: { name: 'Plug da ventoinha', detail: 'Ponta do cabo que sai do cooler.' },
  mb_cpu_fan: { name: 'CPU_FAN', detail: 'Header para a ventoinha do processador.' },
  case_button: { name: 'Ponta do botão frontal', detail: 'Cabo que sai do botão de ligar.' },
  mb_pwr_sw: { name: 'F_PANEL / PWR_SW', detail: 'Par de pinos do botão de ligar neste modelo fictício.' },
  mb_sata1: { name: 'SATA_1', detail: 'Porta de dados para unidade SATA.' },
  disk_data: { name: 'Dados do SSD', detail: 'Entrada de dados da unidade SATA.' },
  psu_sata: { name: 'Saída SATA da fonte', detail: 'Fornece energia à unidade SATA.' },
  disk_power: { name: 'Energia do SSD', detail: 'Entrada de energia da unidade SATA.' },
  gpu_hdmi: { name: 'HDMI da GPU', detail: 'Saída de vídeo da placa dedicada.' },
  monitor_hdmi: { name: 'HDMI do monitor', detail: 'Entrada digital do monitor.' },
  mb_vga: { name: 'VGA da placa-mãe', detail: 'Saída que exigiria vídeo integrado no processador.' },
  monitor_vga: { name: 'VGA do monitor', detail: 'Entrada analógica do monitor.' },
  vrm: { name: 'VRM', detail: 'Circuito que regula a energia recebida pelo processador.' },
  chipset: { name: 'Chipset', detail: 'Controla recursos de comunicação da placa.' },
  cmos: { name: 'Bateria CMOS', detail: 'Mantém configurações e relógio quando desligado.' },
  usb_header: { name: 'Header USB frontal', detail: 'Conexão das portas USB do gabinete.' },
  audio_header: { name: 'Header de áudio frontal', detail: 'Conexão de áudio do gabinete.' },
  rear_io: { name: 'Painel traseiro I/O', detail: 'Grupo de portas acessíveis na traseira do gabinete.' },
}

const emptyConnections = (): Record<CableId, string[]> => ({
  ac: [], atx24: [], eps8: [], cpu_fan: [], front_panel: [], sata_data: [], sata_power: [], hdmi: [], vga: [],
})
const emptyCableEnds = (): HardwareState['cableEnds'] => Object.fromEntries(Object.keys(cableInfo).map(id => [id, {}])) as HardwareState['cableEnds']

function connected(connections: HardwareState['connections'], cable: CableId): boolean {
  return cableInfo[cable].ends.every(end => connections[cable].includes(end))
}

function cableReady(state: HardwareState, cable: CableId): boolean {
  return connected(state.connections, cable) && state.cables[cable].condition === 'good'
}

function record(state: HardwareState, message: string, changes: Partial<HardwareState> = {}): HardwareState {
  return { ...state, ...changes, feedback: message, journal: [...state.journal, message].slice(-100) }
}

function maintenanceAllowed(state: HardwareState): boolean {
  return !state.psuOn && state.connections.ac.length === 0
}

function looseSpot(index: number): { x: number; y: number } {
  return { x: 850 + index % 5 * 45, y: 580 + Math.floor(index / 5) % 5 * 22 }
}

export function createHardwareCase(caseId: HardwareCaseId): HardwareState {
  const parts: HardwareState['parts'] = {
    cpu: 'cpu_i5', cooler: 'cooler_stock', dimm_a2: 'ram_good', dimm_b2: null,
    pcie_x16: 'gpu', m2: null, sata_bay: 'ssd_sata_good', front_button: 'button_good',
  }
  const connections = emptyConnections()
  for (const id of Object.keys(cableInfo) as CableId[]) connections[id] = [...cableInfo[id].ends]
  connections.vga = []
  const inventory: PartId[] = []
  const setup = caseSetup[caseId]
  for (const cable of setup.missingCables ?? []) connections[cable] = []
  if (setup.part) parts[setup.part.slot] = setup.part.part
  if (caseId === 'video') connections.vga = [...cableInfo.vga.ends]
  const cables = Object.fromEntries((Object.keys(cableInfo) as CableId[]).map(id => [id, { length: id === 'atx24' ? 720 : id === 'eps8' ? 300 : id === 'sata_data' ? 220 : 900, condition: 'good' as const }])) as HardwareState['cables']
  for (const cable of setup.brokenCables ?? []) cables[cable].condition = 'broken'
  return {
    caseId, parts, inventory, loosePositions: [], looseLocations: [], connections, cableEnds: emptyCableEnds(), psuOn: false, powered: false, lastTest: null,
    psu: { kind: setup.manualVoltage ? 'manual' : 'automatic', voltage: setup.manualVoltage ? 220 : 127, supply: 127, failed: Boolean(setup.faultyPsu) },
    cables, objects: { motherboard: { x: 520, y: 325 }, psu: { x: 115, y: 245 }, ssd: { x: 965, y: 450 }, monitor: { x: 965, y: 190 } },
    stabilizerOn: true,
    feedback: hardwareCases[caseId].symptom,
    journal: [`Chamado aberto: ${hardwareCases[caseId].symptom}`],
  }
}

function testMachine(state: HardwareState, method: 'button' | 'bridge'): { code: TestCode; text: string; method: 'button' | 'bridge' } {
  if (!powerAvailable(state, cable => cableReady(state, cable))) {
    return { code: 'no_power', text: 'Sem energia. Confira cabo de força, chave da fonte, ATX 24 pinos e EPS 8 pinos.', method }
  }
  if (method === 'button' && (!cableReady(state, 'front_panel') || state.parts.front_button !== 'button_good')) {
    return { code: 'no_power', text: 'O botão frontal não aciona a partida. Os pinos PWR_SW podem ajudar a isolar o defeito.', method }
  }
  if (state.parts.cpu !== 'cpu_i5' || state.parts.cooler !== 'cooler_stock' || !cableReady(state, 'cpu_fan')) {
    return { code: 'cpu_error', text: 'LED CPU aceso: confira processador, cooler e conexão CPU_FAN.', method }
  }
  if (![state.parts.dimm_a2, state.parts.dimm_b2].includes('ram_good') || [state.parts.dimm_a2, state.parts.dimm_b2].includes('ram_faulty')) {
    return { code: 'dram_error', text: 'LED DRAM aceso: a inicialização parou na memória. Teste outro módulo e confira o slot DIMM.', method }
  }
  if (state.parts.pcie_x16 !== 'gpu' || !cableReady(state, 'hdmi') || cableReady(state, 'vga')) {
    return { code: 'video_missing', text: 'POST passou pela RAM, mas não há imagem: esta CPU não oferece vídeo integrado. Use o HDMI da GPU.', method }
  }
  if (!state.parts.sata_bay || !cableReady(state, 'sata_data') || !cableReady(state, 'sata_power')) {
    return { code: 'storage_missing', text: 'LED BOOT aceso: unidade SATA ausente. Confira o cabo de dados e a energia do SSD.', method }
  }
  if (state.parts.sata_bay === 'ssd_sata_faulty') {
    return { code: 'storage_fault', text: 'O SSD recebe energia, mas falha na leitura. Compare com uma unidade funcional.', method }
  }
  return { code: 'boot_ok', text: method === 'bridge' ? 'A máquina iniciou ao fechar os pinos PWR_SW com a chave de fenda. Isso isolou o botão frontal, mas o reparo ainda precisa ser confirmado pelo botão.' : `Inicialização concluída: imagem no monitor e unidade SATA detectada${state.parts.m2 ? '; SSD M.2 adicional detectado' : ''}.`, method }
}

export function isHardwareResolved(state: HardwareState): boolean {
  return state.lastTest?.code === 'boot_ok' && state.lastTest.method === 'button'
}

export function applyHardwareAction(state: HardwareState, action: HardwareAction): HardwareState {
  if (action.type === 'setStabilizer') return record(state, action.on ? 'Estabilizador fictício ligado.' : 'Estabilizador fictício desligado.', { stabilizerOn: action.on, powered: action.on ? state.powered : false, lastTest: null })
  if (action.type === 'takePart') return record(state, `${partInfo[action.part].name} retirado do armário.`, { inventory: [...state.inventory, action.part], loosePositions: [...state.loosePositions, looseSpot(state.inventory.length)], looseLocations: [...state.looseLocations, 'tray'] })
  if (action.type === 'moveLoose') {
    if (!maintenanceAllowed(state)) return action.transient ? state : record(state, 'Desligue e desconecte a alimentação antes de mover peças soltas.')
    if (!Number.isInteger(action.index) || action.index < 0 || action.index >= state.inventory.length || !Number.isFinite(action.x) || !Number.isFinite(action.y) || action.x < 0 || action.x > SCENE_WIDTH || action.y < 0 || action.y > 700) return action.transient ? state : record(state, 'Peça ou posição inválida para a bancada.')
    const loosePositions = [...state.loosePositions]
    loosePositions[action.index] = { x: action.x, y: action.y }
    const looseLocations = [...state.looseLocations]
    looseLocations[action.index] = action.location ?? 'table'
    return action.transient ? { ...state, loosePositions, looseLocations } : record(state, `${partInfo[state.inventory[action.index]].name} posicionada na bancada.`, { loosePositions, looseLocations })
  }
  if (action.type === 'setVoltage') {
    if (state.psu.kind !== 'manual' || state.psuOn || state.connections.ac.length) return record(state, 'Desligue a fonte manual e retire o cabo de força antes de ajustar o seletor.')
    return record(state, `Seletor ajustado para ${action.voltage} V.`, { psu: { ...state.psu, voltage: action.voltage }, lastTest: null })
  }
  if (action.type === 'replacePsu') {
    if (!maintenanceAllowed(state)) return record(state, 'Desligue e desconecte a alimentação antes de trocar a fonte.')
    return record(state, 'Fonte de reposição retirada do armário e instalada.', { psu: { ...state.psu, failed: false }, lastTest: null })
  }
  if (action.type === 'replaceCable') {
    if (!maintenanceAllowed(state)) return record(state, 'Desligue e desconecte a alimentação antes de trocar cabos.')
    return record(state, `${cableInfo[action.cable].name} de reposição retirado do armário.`, { cables: { ...state.cables, [action.cable]: { ...state.cables[action.cable], condition: 'good' } }, connections: { ...state.connections, [action.cable]: [] }, lastTest: null })
  }
  if (action.type === 'moveObject') {
    if (action.object !== 'psu' && action.object !== 'ssd' && action.object !== 'monitor') return state
    if (!Number.isFinite(action.x) || !Number.isFinite(action.y) || action.x < 0 || action.x > SCENE_WIDTH || action.y < 0 || action.y > 700) return record(state, 'Posição fora da bancada.')
    if (action.object !== 'monitor' && !maintenanceAllowed(state)) return action.transient ? state : record(state, 'Desligue e desconecte a alimentação antes de mover componentes internos.')
    const objects = { ...state.objects, [action.object]: { x: action.x, y: action.y } }
    const cables = { ...state.cables }
    let broken = false
    let tense = false
    for (const cable of Object.keys(cableInfo) as CableId[]) {
      if (state.connections[cable].length !== 2 || cables[cable].condition === 'broken') continue
      const distance = cableDistance(cable, objects, cableInfo[cable].ends)
      const status = cableTension(distance, cables[cable].length)
      if (status === 'broken') { cables[cable] = { ...cables[cable], condition: 'broken' }; broken = true }
      else if (status === 'tense') tense = true
    }
    const message = broken ? 'Cabo tensionado além do comprimento e rompido na simulação. Busque outro no armário.' : tense ? 'Objeto reposicionado. Cabo com mais de 90% do alcance: tensão visível; aproxime as pontas.' : 'Objeto reposicionado na bancada.'
    const changes = { objects, cables, lastTest: null }
    return action.transient && !broken ? { ...state, ...changes, feedback: message } : record(state, message, changes)
  }
  if (action.type === 'setPsu') {
    if (action.on && wrongVoltage(state.psu) && connected(state.connections, 'ac')) return record(state, 'Seleção incorreta: a fonte simulada foi inutilizada. Busque outra no armário.', { psu: { ...state.psu, failed: true }, psuOn: true, powered: false, lastTest: null })
    return record(state, action.on ? 'Chave I/O da fonte ligada. Teste a partida.' : 'Chave I/O da fonte desligada.', { psuOn: action.on, powered: action.on ? state.powered : false, lastTest: null })
  }
  if (action.type === 'pressPower') {
    const pinsOccupied = state.connections.front_panel.includes('mb_pwr_sw')
    if (action.method === 'bridge' && pinsOccupied) return record(state, 'Pinos PWR_SW ocupados pelo cabo do botão. Desligue a fonte, desconecte a alimentação e solte essa ponta antes de usar a chave de fenda.')
    if (action.method === 'button' && !pinsOccupied) return record(state, 'Pinos PWR_SW livres: o botão não pode acionar a máquina. Reconecte a ponta do cabo na placa.')
    if (wrongVoltage(state.psu) && state.psuOn && connected(state.connections, 'ac')) {
      return record(state, 'Seleção incorreta: a fonte simulada foi inutilizada. Busque outra no armário.', { psu: { ...state.psu, failed: true }, powered: false, lastTest: { code: 'no_power', text: 'Fonte simulada inutilizada por seleção incorreta.', method: action.method } })
    }
    const lastTest = testMachine(state, action.method)
    return record(state, lastTest.text, { lastTest, powered: lastTest.code !== 'no_power' })
  }
  if (action.type === 'install') {
    if (!slotInfo[action.slot].accepts.includes(action.part)) return record(state, `Peça incompatível com ${slotInfo[action.slot].name}.`)
    if (!maintenanceAllowed(state)) return record(state, 'Desligue a fonte e desconecte o cabo de força antes de mexer nas peças.')
    if (action.slot === 'cooler' && !state.parts.cpu) return record(state, 'Instale a CPU antes de fixar o cooler.')
    if (!state.inventory.includes(action.part) || (action.index !== undefined && state.inventory[action.index] !== action.part)) return record(state, 'Essa peça não está na bandeja de peças.')
    if (state.parts[action.slot]) return record(state, `O slot ${slotInfo[action.slot].name} já está ocupado. Remova a peça primeiro.`)
    const parts = { ...state.parts, [action.slot]: action.part }
    const inventory = [...state.inventory]
    const loosePositions = [...state.loosePositions]
    const looseLocations = [...state.looseLocations]
    const index = action.index ?? inventory.indexOf(action.part)
    inventory.splice(index, 1); loosePositions.splice(index, 1); looseLocations.splice(index, 1)
    return record(state, `Peça instalada em ${slotInfo[action.slot].name}: ${partInfo[action.part].name}.`, { parts, inventory, loosePositions, looseLocations, lastTest: null })
  }
  if (action.type === 'remove') {
    if (!maintenanceAllowed(state)) return record(state, 'Desligue a fonte e desconecte o cabo de força antes de remover peças.')
    if (action.slot === 'cpu' && state.parts.cooler) return record(state, 'Remova o cooler antes de retirar a CPU.')
    if (action.slot === 'cooler' && state.connections.cpu_fan.length) return record(state, 'Desconecte o cabo CPU_FAN antes de remover o cooler.')
    if (action.slot === 'pcie_x16' && state.connections.hdmi.length) return record(state, 'Desconecte o cabo HDMI antes de remover a placa de vídeo.')
    if (action.slot === 'sata_bay' && (state.connections.sata_data.includes('disk_data') || state.connections.sata_power.includes('disk_power'))) return record(state, 'Solte as pontas DATA e POWER dos cabos SATA no SSD antes de removê-lo.')
    const part = state.parts[action.slot]
    if (!part) return record(state, `${slotInfo[action.slot].name} já está vazio.`)
    return record(state, `Peça removida de ${slotInfo[action.slot].name}: ${partInfo[part].name}.`, {
      parts: { ...state.parts, [action.slot]: null }, inventory: [...state.inventory, part], loosePositions: [...state.loosePositions, looseSpot(state.inventory.length)], looseLocations: [...state.looseLocations, 'tray'], lastTest: null,
    })
  }
  if (action.type === 'disconnectEnd') {
    if (state.psuOn || (action.cable !== 'ac' && !maintenanceAllowed(state))) return record(state, 'Desligue a fonte e desconecte o cabo de força antes de alterar as conexões.')
    if (!state.connections[action.cable].includes(action.connector)) return state
    return record(state, `Ponta de ${cableInfo[action.cable].name} desconectada.`, {
      connections: { ...state.connections, [action.cable]: state.connections[action.cable].filter(end => end !== action.connector) },
      cableEnds: { ...state.cableEnds, [action.cable]: { ...state.cableEnds[action.cable], [action.connector]: cablePoint(action.connector, state.objects) } },
      powered: false, lastTest: null,
    })
  }
  if (action.type === 'moveCableEnd') {
    if (!cableInfo[action.cable].ends.includes(action.connector) || state.connections[action.cable].includes(action.connector) || !Number.isFinite(action.x) || !Number.isFinite(action.y) || action.x < 0 || action.x > SCENE_WIDTH || action.y < 0 || action.y > 700) return state
    const position = avoidPhysicalControls(action, state.objects)
    const cableEnds = { ...state.cableEnds, [action.cable]: { ...state.cableEnds[action.cable], [action.connector]: position } }
    const other = cableInfo[action.cable].ends.find(end => end !== action.connector)!
    const distance = Math.hypot(position.x - cablePoint(other, state.objects).x, position.y - cablePoint(other, state.objects).y)
    const broke = state.connections[action.cable].includes(other) && state.cables[action.cable].condition === 'good' && cableTension(distance, state.cables[action.cable].length) === 'broken'
    if (broke) return record(state, `${cableInfo[action.cable].name} rompeu durante o movimento. Busque outro no armário.`, { cableEnds, cables: { ...state.cables, [action.cable]: { ...state.cables[action.cable], condition: 'broken' } } })
    return action.transient ? { ...state, cableEnds } : record(state, `Ponta de ${cableInfo[action.cable].name} posicionada na bancada.`, { cableEnds })
  }
  if (action.type === 'disconnect') {
    if (state.psuOn) return record(state, 'Desligue a chave I/O da fonte antes de desconectar cabos.')
    if (action.cable !== 'ac' && !maintenanceAllowed(state)) return record(state, 'Desconecte o cabo de força antes de alterar conexões internas.')
    if (state.connections[action.cable].length === 0) return record(state, `${cableInfo[action.cable].name} já está desconectado.`)
    return record(state, `${cableInfo[action.cable].name} desconectado.`, {
      connections: { ...state.connections, [action.cable]: [] }, powered: false, lastTest: null,
    })
  }
  if (state.psuOn || (action.cable !== 'ac' && !maintenanceAllowed(state))) {
    return record(state, 'Desligue a fonte e desconecte o cabo de força antes de alterar as conexões.')
  }
  const ends = cableInfo[action.cable].ends
  if (state.cables[action.cable].condition === 'broken') return record(state, `${cableInfo[action.cable].name} está rompido. Retire outro no armário.`)
  if (!ends.includes(action.connector)) return record(state, `Conector incompatível com ${cableInfo[action.cable].name}.`)
  const current = state.connections[action.cable]
  if (current.includes(action.connector)) return record(state, 'Esta ponta já está conectada.')
  if (current.length === 2) return record(state, 'As duas pontas deste cabo já estão conectadas.')
  if ((action.cable === 'hdmi' && connected(state.connections, 'vga') || action.cable === 'vga' && connected(state.connections, 'hdmi')) && current.length === 1) {
    return record(state, 'Desconecte o outro cabo de vídeo antes de ligar este ao monitor.')
  }
  const connections = { ...state.connections, [action.cable]: [...current, action.connector] }
  const cableEnds = { ...state.cableEnds, [action.cable]: { ...state.cableEnds[action.cable] } }
  delete cableEnds[action.cable][action.connector]
  if (connections[action.cable].length === 2) {
    const status = cableTension(cableDistance(action.cable, state.objects, ends), state.cables[action.cable].length)
    if (status === 'broken') return record(state, `${cableInfo[action.cable].name} ultrapassou o comprimento e rompeu na simulação. Busque outro no armário.`, { connections, cableEnds, cables: { ...state.cables, [action.cable]: { ...state.cables[action.cable], condition: 'broken' } }, lastTest: null })
    if (status === 'tense') return record(state, `${cableInfo[action.cable].name} ligado, mas tensionado acima de 90% do alcance.`, { connections, cableEnds, lastTest: null })
  }
  const message = connections[action.cable].length === 2
    ? `${cableInfo[action.cable].name} ligado entre ${connectorInfo[ends[0]].name} e ${connectorInfo[ends[1]].name}.`
    : `Primeira ponta de ${cableInfo[action.cable].name} conectada. Escolha a outra ponta.`
  return record(state, message, { connections, cableEnds, lastTest: null })
}
