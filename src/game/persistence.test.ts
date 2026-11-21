import { describe, expect, it } from 'vitest'
import { createGame } from './game'
import { loadSession, saveSession } from './persistence'

function memoryStore() {
  const data = new Map<string, string>()
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } }
}

describe('salvamento local', () => {
  it('invalida teste antigo pela chave com os pinos ocupados sem perder progresso', () => {
    const storage = memoryStore()
    const game = createGame()
    game.hardware.power.lastTest = { code: 'boot_ok', method: 'bridge', text: 'Teste antigo' }
    game.hardware.power.powered = true
    game.hardware.power.journal.push('Progresso preservado')
    storage.setItem('oficina-ti-session', JSON.stringify({ version: 3, started: true, game }))
    const loaded = loadSession(storage)!
    expect(loaded.game.hardware.power.lastTest).toBeNull()
    expect(loaded.game.hardware.power.powered).toBe(false)
    expect(loaded.game.hardware.power.journal).toContain('Progresso preservado')
    expect(loaded.game.hardware.power.connections.front_panel).toContain('mb_pwr_sw')
  })
  it('preserva a posição antiga na mesa e restaura localizações novas', () => {
    const storage = memoryStore()
    const game = createGame()
    game.hardware.power.inventory = ['ram_good']
    game.hardware.power.loosePositions = [{ x: 411, y: 503 }]
    const old = structuredClone(game)
    delete (old.hardware.power as Partial<typeof old.hardware.power>).looseLocations
    storage.setItem('oficina-ti-session', JSON.stringify({ version: 3, started: true, game: old }))
    expect(loadSession(storage)?.game.hardware.power.loosePositions).toEqual([{ x: 411, y: 503 }])
    expect(loadSession(storage)?.game.hardware.power.looseLocations).toEqual(['table'])
    game.hardware.power.looseLocations = ['tray']
    saveSession(storage, { started: true, game })
    expect(loadSession(storage)?.game.hardware.power.looseLocations).toEqual(['tray'])
  })
  it('migra um save da versão 2 preservando chamados e diagnósticos', () => {
    const storage = memoryStore()
    const game = createGame()
    game.hardware.power.journal.push('Diagnóstico antigo')
    game.hardware.power.connections.atx24 = ['psu_atx24']
    const old = structuredClone(game)
    for (const item of Object.values(old.hardware)) delete (item as Partial<typeof item>).cableEnds
    storage.setItem('oficina-ti-session', JSON.stringify({ version: 2, started: true, game: old }))
    const loaded = loadSession(storage)
    expect(loaded?.game.hardware.power.journal).toContain('Diagnóstico antigo')
    expect(loaded?.game.hardware.power.cableEnds.atx24).toEqual({})
    expect(loaded?.game.tickets).toHaveLength(8)
  })
  it('restaura o estado da partida e dos cabos no mesmo navegador', () => {
    const storage = memoryStore()
    const game = createGame()
    game.hardware.power.connections.atx24 = ['psu_atx24']
    game.hardware.power.cableEnds.atx24.mb_atx24 = { x: 740, y: 320 }
    saveSession(storage, { started: true, game })
    expect(loadSession(storage)?.game.hardware.power.connections.atx24).toEqual(['psu_atx24'])
    expect(loadSession(storage)?.game.hardware.power.cableEnds.atx24.mb_atx24).toEqual({ x: 740, y: 320 })
    expect(loadSession(storage)?.started).toBe(true)
  })

  it('salva posições, cabo rompido e fonte inutilizada na versão atual', () => {
    const storage = memoryStore()
    const game = createGame()
    game.hardware.voltage.psu.failed = true
    game.hardware.voltage.cables.atx24.condition = 'broken'
    game.hardware.voltage.objects.motherboard = { x: 630, y: 325 }
    const legacy = game.hardware.voltage as unknown as Record<string, unknown>
    legacy.boardScrews = false
    legacy.boardOnSupport = true
    game.hardware.voltage.inventory = ['ram_good']
    game.hardware.voltage.loosePositions = [{ x: 930, y: 600 }]
    saveSession(storage, { started: true, game })
    const loaded = loadSession(storage)!.game.hardware.voltage
    expect(loaded.psu.failed).toBe(true)
    expect(loaded.cables.atx24.condition).toBe('broken')
    expect(loaded.objects.motherboard).toEqual({ x: 520, y: 325 })
    expect('boardScrews' in loaded || 'boardOnSupport' in loaded).toBe(false)
    expect(loaded.loosePositions).toEqual([{ x: 930, y: 600 }])
  })

  it('descarta dados corrompidos ou de outra versão', () => {
    const storage = memoryStore()
    storage.setItem('oficina-ti-session', '{invalid')
    expect(loadSession(storage)).toBeNull()
    storage.setItem('oficina-ti-session', JSON.stringify({ version: 99, started: true, game: createGame() }))
    expect(loadSession(storage)).toBeNull()
  })

  it('não impede o jogo quando o navegador bloqueia armazenamento', () => {
    const storage = { getItem: () => { throw new Error('bloqueado') }, setItem: () => { throw new Error('bloqueado') } }
    expect(loadSession(storage)).toBeNull()
    expect(() => saveSession(storage, { started: false, game: createGame() })).not.toThrow()
  })
})
