import { describe, expect, it } from 'vitest'
import { createGame, advanceGame, movePlayer, startTicket, submitAnswer, finishTicket } from './game'

describe('partida', () => {
  it('libera chamados nos tempos previstos e termina ao resolver os três', () => {
    let game = createGame()
    expect(game.tickets.map(ticket => ticket.status)).toEqual(['waiting', 'locked', 'locked'])
    game = advanceGame(game, 45)
    expect(game.tickets[1].status).toBe('waiting')
    game = advanceGame(game, 45)
    expect(game.tickets[2].status).toBe('waiting')
    for (const ticket of game.tickets) {
      game = startTicket(game, ticket.id)
      game = submitAnswer(game, ticket.id, ticket.answer)
      game = finishTicket(game, ticket.id)
    }
    expect(game.phase).toBe('finished')
    expect(game.completed).toBe(3)
  })

  it('não aceita resposta de outro chamado e dá dica após erro', () => {
    let game = startTicket(createGame(), 'hardware')
    game = submitAnswer(game, 'hardware', 'cpu')
    expect(game.tickets[0].status).toBe('active')
    expect(game.tickets[0].attempts).toBe(1)
    expect(game.tickets[0].feedback).toMatch(/memória/i)
    game = submitAnswer(game, 'hardware', 'ram')
    expect(game.tickets[0].status).toBe('ready')
    expect(game.tickets[0].attempts).toBe(1)
    expect(submitAnswer(game, 'database', 'join')).toBe(game)
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

  it('encerra no limite de cinco minutos e não avança depois', () => {
    const game = advanceGame(createGame(), 300)
    expect(game.phase).toBe('finished')
    expect(advanceGame(game, 10)).toBe(game)
  })

  it('mostra o efeito técnico de cada solução correta', () => {
    let game = createGame()
    for (const ticket of game.tickets) {
      game = advanceGame(game, ticket.arrival - game.elapsed)
      game = startTicket(game, ticket.id)
      game = submitAnswer(game, ticket.id, ticket.answer)
      const solved = game.tickets.find(item => item.id === ticket.id)!
      expect(solved.feedback).toMatch(/(RAM|CPU|Lia)/)
      game = finishTicket(game, ticket.id)
    }
  })
})
