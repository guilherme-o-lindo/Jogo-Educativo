import { describe, expect, it } from 'vitest'
import { applyHardwareToGame, createGame, finishTicket, movePlayer, pathToStation, resetHardwareInGame, startTicket, submitAnswer } from './game'

describe('fluxo dos chamados', () => {
  it('começa sem relógio, libera hardware em sequência e termina com oito entregas', () => {
    let game = createGame()
    expect(game.tickets.map(ticket => ticket.status)).toEqual(['waiting', 'locked', 'locked', 'locked', 'locked', 'locked', 'waiting', 'waiting'])
    expect('elapsed' in game).toBe(false)
    for (const id of ['hardware-power', 'hardware-video', 'hardware-storage', 'hardware-psu', 'hardware-voltage', 'hardware-combined', 'os', 'database'] as const) {
      game = startTicket(game, id)
      if (id.startsWith('hardware-')) {
        game = { ...game, tickets: game.tickets.map(ticket => ticket.id === id ? { ...ticket, status: 'ready' } : ticket) }
      } else {
        game = submitAnswer(game, id, game.tickets.find(ticket => ticket.id === id)!.answer!)
      }
      expect(game.tickets.find(ticket => ticket.id === id)?.status).toBe('ready')
      game = finishTicket(game, id)
    }
    expect(game.completed).toBe(8)
    expect(game.phase).toBe('finished')
    expect(game.tickets.every(ticket => ticket.status === 'done')).toBe(true)
  })

  it('não aceita respostas simples em chamado de hardware', () => {
    const game = startTicket(createGame(), 'hardware-power')
    expect(submitAnswer(game, 'hardware-power', 'ram')).toBe(game)
  })

  it('permite reiniciar o diagnóstico atual sem reiniciar outros chamados', () => {
    let game = startTicket(createGame(), 'hardware-power')
    game = applyHardwareToGame(game, { type: 'connect', cable: 'atx24', connector: 'psu_atx24' })
    expect(game.hardware.power.connections.atx24).toEqual(['psu_atx24'])
    game = resetHardwareInGame(game, 'power')
    expect(game.hardware.power.connections.atx24).toEqual([])
    expect(game.tickets[0].status).toBe('active')
    expect(game.hardware.video.caseId).toBe('video')
  })

  it('reabre um chamado pronto se o estado da máquina mudar antes da entrega', () => {
    let game = startTicket(createGame(), 'hardware-power')
    game = { ...game, tickets: game.tickets.map(ticket => ticket.id === 'hardware-power' ? { ...ticket, status: 'ready' } : ticket) }
    game = applyHardwareToGame(game, { type: 'setStabilizer', on: false })
    expect(game.tickets.find(ticket => ticket.id === 'hardware-power')?.status).toBe('active')
  })

  it('respeita limites e obstáculos na movimentação', () => {
    let game = createGame()
    game = movePlayer(game, 0, -1)
    expect(game.player).toEqual({ x: 6, y: 5 })
    game = movePlayer(game, 1, 0)
    expect(game.player).toEqual({ x: 7, y: 5 })
    for (let i = 0; i < 20; i += 1) game = movePlayer(game, 1, 0)
    expect(game.player.x).toBe(13)
  })

  it('traça rota até realmente alcançar a distância de interação', () => {
    const path = pathToStation({ x: 6, y: 5.4 }, 'papeis')
    expect(path.length).toBeGreaterThan(0)
    const last = path.at(-1)!
    expect(Math.hypot(last.x - 6, last.y - 4)).toBeLessThanOrEqual(1.25)
  })
})
