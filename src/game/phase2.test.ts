import { describe, expect, it } from 'vitest'
import { applyHardwareAction as act, createHardwareCase, isHardwareResolved, type HardwareAction } from '../hardware/hardware'
import { createGame, finishTicket, movePlayer, pathToStation, startTicket } from './game'
import { loadSession } from './persistence'
import { cableDistance, cableTension } from '../hardware/cableGeometry'
import { cableInfo } from '../hardware/hardware'

describe('fase 2', () => {
  const plug = (state: ReturnType<typeof createHardwareCase>, cable: keyof ReturnType<typeof createHardwareCase>['connections'], a: string, b: string) => act(act(state, { type: 'connect', cable, connector: a }), { type: 'connect', cable, connector: b })
  const prepare = (state: ReturnType<typeof createHardwareCase>) => act(act(state, { type: 'setPsu', on: false }), { type: 'disconnect', cable: 'ac' })
  it('oferece oito chamados e movimento contínuo com caminho até a estação', () => {
    const game = createGame()
    expect(game.tickets).toHaveLength(8)
    expect(movePlayer(game, .15, 0).player.x).toBeCloseTo(game.player.x + .15)
    expect(pathToStation(game.player, 'hardware').length).toBeGreaterThan(0)
  })

  it('exige partida pelo botão nos seis casos', () => {
    for (const id of ['power', 'video', 'storage', 'psu', 'voltage', 'combined'] as const) {
      const state = createHardwareCase(id)
      expect(state.caseId).toBe(id)
      expect(isHardwareResolved({ ...state, lastTest: { code: 'boot_ok', text: '', method: 'bridge' } })).toBe(false)
    }
  })

  it('inutiliza apenas a fonte simulada após tensão errada e permite reposição', () => {
    let state = createHardwareCase('voltage')
    state = act(state, { type: 'setPsu', on: true })
    expect(state.psu.failed).toBe(true)
    state = act(state, { type: 'pressPower', method: 'button' })
    expect(state.psu.failed).toBe(true)
    state = act(state, { type: 'setVoltage', voltage: 127 })
    expect(state.lastTest?.code).toBe('no_power')
    state = prepare(state)
    state = act(state, { type: 'replacePsu' })
    expect(state.psu.failed).toBe(false)
  })

  it('rompe cabo da fonte esticado além do alcance e permite repor', () => {
    let state = prepare(createHardwareCase('video'))
    state = act(state, { type: 'moveObject', object: 'psu', x: 1210, y: 385 })
    expect(state.cables.eps8.condition).toBe('broken')
    state = act(state, { type: 'replaceCable', cable: 'eps8' })
    expect(state.cables.eps8.condition).toBe('good')
  })

  it('sinaliza tensão do cabo ao mover a fonte', () => {
    let state = prepare(createHardwareCase('video'))
    const position = { ...state.objects, psu: { x: 115, y: 395 } }
    expect(cableTension(cableDistance('eps8', position, cableInfo.eps8.ends), state.cables.eps8.length)).toBe('tense')
    state = act(state, { type: 'moveObject', object: 'psu', x: 115, y: 395 })
    expect(state.feedback).toMatch(/90%/)
  })

  it('mantém a placa fixa no gabinete ao mover outros equipamentos', () => {
    let state = prepare(createHardwareCase('video'))
    state = act(state, { type: 'moveObject', object: 'psu', x: 1210, y: 385 })
    expect(state.objects.motherboard).toEqual({ x: 520, y: 325 })
    const invalid = { type: 'moveObject', object: 'motherboard', x: 630, y: 325 } as unknown as HardwareAction
    expect(act(state, invalid).objects.motherboard).toEqual({ x: 520, y: 325 })
  })

  it('cabo AC rompido e estabilizador desligado cortam a energia', () => {
    let state = createHardwareCase('video')
    state = act(state, { type: 'setPsu', on: true })
    state = act(state, { type: 'pressPower', method: 'button' })
    expect(state.powered).toBe(true)
    state = act(state, { type: 'setStabilizer', on: false })
    expect(state.powered).toBe(false)
    state = { ...state, stabilizerOn: true, cables: { ...state.cables, ac: { ...state.cables.ac, condition: 'broken' } } }
    expect(act(state, { type: 'pressPower', method: 'button' }).lastTest?.code).toBe('no_power')
  })

  it('permite testar os pinos PWR_SW em todos os atendimentos', () => {
    for (const id of ['power', 'video', 'storage', 'psu', 'voltage', 'combined'] as const) {
      let state = act(createHardwareCase(id), { type: 'disconnect', cable: 'ac' })
      state = act(state, { type: 'disconnectEnd', cable: 'front_panel', connector: 'mb_pwr_sw' })
      state = act(state, { type: 'pressPower', method: 'bridge' })
      expect(state.lastTest?.method).toBe('bridge')
    }
  })

  it('posiciona peças soltas e mantém posições alinhadas ao inventário', () => {
    let state = createHardwareCase('video')
    state = prepare(state)
    state = act(state, { type: 'takePart', part: 'ram_good' })
    state = act(state, { type: 'moveLoose', index: 0, x: 900, y: 550 })
    expect(state.loosePositions[0]).toEqual({ x: 900, y: 550 })
    state = act(state, { type: 'remove', slot: 'dimm_a2' })
    expect(state.loosePositions).toHaveLength(2)
    state = act(state, { type: 'install', part: 'ram_good', slot: 'dimm_a2' })
    expect(state.inventory).toEqual(['ram_faulty'])
    expect(state.loosePositions).toHaveLength(1)
  })

  it('migra uma partida encerrada na versão 1 e conserva os chamados antigos', () => {
    const old = createGame()
    const legacy = { ...old, phase: 'finished', completed: 5, tickets: old.tickets.filter(ticket => ['hardware-power', 'hardware-video', 'hardware-storage', 'os', 'database'].includes(ticket.id)).map(ticket => ({ ...ticket, status: 'done' })) }
    const storage = { getItem: () => JSON.stringify({ version: 1, started: true, game: legacy }), setItem: () => {} }
    const loaded = loadSession(storage)
    expect(loaded?.game.tickets).toHaveLength(8)
    expect(loaded?.game.completed).toBe(5)
    expect(loaded?.game.phase).toBe('playing')
    expect(loaded?.game.tickets.find(ticket => ticket.id === 'hardware-psu')?.status).toBe('waiting')
  })

  it('migra diagnóstico parcial com peça já retirada e chamado ativo', () => {
    const old = createGame()
    old.hardware.video.inventory = ['ram_good']
    old.hardware.video.journal.push('RAM de reposição retirada')
    const legacy = { ...old, completed: 1, tickets: old.tickets.filter(ticket => ['hardware-power', 'hardware-video', 'hardware-storage', 'os', 'database'].includes(ticket.id)).map(ticket => ({ ...ticket, status: ticket.id === 'hardware-power' ? 'done' : ticket.id === 'hardware-video' ? 'active' : ticket.status })) }
    const storage = { getItem: () => JSON.stringify({ version: 1, started: true, game: legacy }), setItem: () => {} }
    const loaded = loadSession(storage)
    expect(loaded?.game.tickets.find(ticket => ticket.id === 'hardware-video')?.status).toBe('active')
    expect(loaded?.game.hardware.video.inventory).toContain('ram_good')
    expect(loaded?.game.hardware.video.loosePositions).toHaveLength(1)
    expect(loaded?.game.hardware.video.journal).toContain('RAM de reposição retirada')
  })

  it('retira personagem de células ocupadas por novas estações ao migrar', () => {
    for (const x of [7, 12]) {
      const old = createGame()
      const legacy = { ...old, player: { x, y: 4 }, tickets: old.tickets.filter(ticket => ['hardware-power', 'hardware-video', 'hardware-storage', 'os', 'database'].includes(ticket.id)) }
      const storage = { getItem: () => JSON.stringify({ version: 1, started: true, game: legacy }), setItem: () => {} }
      const loaded = loadSession(storage)
      expect(loaded?.game.player).toEqual({ x, y: 5 })
      expect(movePlayer(loaded!.game, 0, .1).player.y).toBeGreaterThan(5)
    }
  })

  it('exige confirmação pelo botão quando save antigo estava pronto após teste de pinos', () => {
    const old = createGame()
    old.hardware.video.lastTest = { code: 'boot_ok', text: 'Pinos testados', method: 'bridge' }
    const legacy = { ...old, completed: 1, tickets: old.tickets.filter(ticket => ['hardware-power', 'hardware-video', 'hardware-storage', 'os', 'database'].includes(ticket.id)).map(ticket => ({ ...ticket, status: ticket.id === 'hardware-power' ? 'done' : ticket.id === 'hardware-video' ? 'ready' : ticket.status })) }
    const storage = { getItem: () => JSON.stringify({ version: 1, started: true, game: legacy }), setItem: () => {} }
    const loaded = loadSession(storage)
    expect(loaded?.game.tickets.find(ticket => ticket.id === 'hardware-video')?.status).toBe('active')
    expect(loaded?.game.hardware.video.lastTest).toBeNull()
  })

  it('resolve fonte defeituosa somente após troca, energia e nova partida', () => {
    let state = createHardwareCase('psu')
    state = act(state, { type: 'setPsu', on: true })
    expect(act(state, { type: 'pressPower', method: 'button' }).lastTest?.code).toBe('no_power')
    state = prepare(state)
    state = act(state, { type: 'replacePsu' })
    state = plug(state, 'ac', 'wall_ac', 'psu_ac')
    state = act(state, { type: 'setPsu', on: true })
    state = act(state, { type: 'pressPower', method: 'button' })
    expect(isHardwareResolved(state)).toBe(true)
  })

  it('partida revela falta de energia ou erro de RAM sem identificar a fonte diretamente', () => {
    let state = createHardwareCase('video')
    expect(act(state, { type: 'pressPower', method: 'button' }).lastTest?.code).toBe('no_power')
    state = act(state, { type: 'setPsu', on: true })
    expect(act(state, { type: 'pressPower', method: 'button' }).lastTest?.code).toBe('dram_error')
    state = createHardwareCase('psu')
    state = act(state, { type: 'setPsu', on: true })
    expect(act(state, { type: 'pressPower', method: 'button' }).lastTest?.code).toBe('no_power')
  })

  it('resolve fonte manual após erro somente com seletor certo e fonte nova', () => {
    let state = createHardwareCase('voltage')
    state = act(state, { type: 'setPsu', on: true })
    state = act(state, { type: 'pressPower', method: 'button' })
    expect(state.psu.failed).toBe(true)
    state = prepare(state)
    state = act(state, { type: 'setVoltage', voltage: 127 })
    state = act(state, { type: 'replacePsu' })
    state = plug(state, 'ac', 'wall_ac', 'psu_ac')
    state = act(state, { type: 'setPsu', on: true })
    state = act(state, { type: 'pressPower', method: 'button' })
    expect(isHardwareResolved(state)).toBe(true)
  })

  it('resolve falhas combinadas em ordem alternativa', () => {
    let state = createHardwareCase('combined')
    state = prepare(state)
    state = act(state, { type: 'replaceCable', cable: 'sata_data' })
    state = plug(state, 'sata_data', 'mb_sata1', 'disk_data')
    state = act(state, { type: 'remove', slot: 'dimm_a2' })
    state = act(state, { type: 'takePart', part: 'ram_good' })
    state = act(state, { type: 'install', part: 'ram_good', slot: 'dimm_a2' })
    state = plug(state, 'eps8', 'psu_eps8', 'mb_eps8')
    state = plug(state, 'ac', 'wall_ac', 'psu_ac')
    state = act(state, { type: 'setPsu', on: true })
    state = act(state, { type: 'pressPower', method: 'button' })
    expect(isHardwareResolved(state)).toBe(true)
  })
})
