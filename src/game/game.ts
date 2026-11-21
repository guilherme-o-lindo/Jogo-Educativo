import { applyHardwareAction, createHardwareCase, isHardwareResolved, type HardwareAction, type HardwareCaseId, type HardwareState } from '../hardware/hardware'

export type TicketId = 'hardware-power' | 'hardware-video' | 'hardware-storage' | 'hardware-psu' | 'hardware-voltage' | 'hardware-combined' | 'os' | 'database'
export type TicketStatus = 'locked' | 'waiting' | 'active' | 'ready' | 'done'
export type Phase = 'playing' | 'finished'

export interface Ticket {
  id: TicketId
  title: string
  requester: string
  topic: string
  station: 'hardware' | 'os' | 'database'
  answer?: string
  status: TicketStatus
  feedback: string
}

export interface Game {
  phase: Phase
  completed: number
  player: { x: number; y: number }
  tickets: Ticket[]
  hardware: Record<HardwareCaseId, HardwareState>
}

export const WIDTH = 14
export const HEIGHT = 9

export const stations = {
  balcão: { x: 1, y: 6 },
  hardware: { x: 3, y: 2 },
  os: { x: 7, y: 2 },
  database: { x: 11, y: 2 },
  entrega: { x: 12, y: 6 },
  papeis: { x: 6, y: 4 },
  computador: { x: 7, y: 4 },
  armario: { x: 12, y: 4 },
} as const

const blocked = new Set(['3,2', '7,2', '11,2', '1,6', '12,6', '6,4', '7,4', '12,4'])

const tickets: Omit<Ticket, 'status' | 'feedback'>[] = [
  { id: 'hardware-power', title: 'Laboratório sem energia', requester: 'Laboratório de informática', topic: 'Hardware · energia', station: 'hardware' },
  { id: 'hardware-video', title: 'Tela apagada no laboratório', requester: 'Laboratório de informática', topic: 'Hardware · vídeo', station: 'hardware' },
  { id: 'hardware-storage', title: 'Disco ausente na secretaria', requester: 'Secretaria', topic: 'Hardware · armazenamento', station: 'hardware' },
  { id: 'hardware-psu', title: 'Fonte sem saída', requester: 'Laboratório de informática', topic: 'Hardware · fonte', station: 'hardware' },
  { id: 'hardware-voltage', title: 'Seletor da fonte manual', requester: 'Laboratório de informática', topic: 'Hardware · energia', station: 'hardware' },
  { id: 'hardware-combined', title: 'Falhas após transporte', requester: 'Secretaria', topic: 'Hardware · diagnóstico', station: 'hardware' },
  { id: 'os', title: 'Computador da biblioteca lento', requester: 'Biblioteca', topic: 'Sistema operacional', station: 'os', answer: 'indexador' },
  { id: 'database', title: 'Relatório de turmas incompleto', requester: 'Secretaria', topic: 'Banco de dados', station: 'database', answer: 'alunos.id=matriculas.aluno_id' },
]

export function createGame(): Game {
  return {
    phase: 'playing',
    completed: 0,
    player: { x: 6, y: 5 },
    tickets: tickets.map(ticket => ({ ...ticket, status: ticket.id.startsWith('hardware-') && ticket.id !== 'hardware-power' ? 'locked' : 'waiting', feedback: '' })),
    hardware: { power: createHardwareCase('power'), video: createHardwareCase('video'), storage: createHardwareCase('storage'), psu: createHardwareCase('psu'), voltage: createHardwareCase('voltage'), combined: createHardwareCase('combined') },
  }
}

export function movePlayer(game: Game, dx: number, dy: number): Game {
  if (game.phase === 'finished' || !Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) + Math.abs(dy) > 1.01) return game
  const x = game.player.x + dx
  const y = game.player.y + dy
  if (x < 0 || x >= WIDTH - .15 || y < 0 || y >= HEIGHT - .15 || blocked.has(`${Math.floor(x + .5)},${Math.floor(y + .5)}`)) return game
  return { ...game, player: { x, y } }
}

export function pathToStation(from: Game['player'], station: keyof typeof stations): Game['player'][] {
  const target = stations[station]
  const start = { x: Math.round(from.x), y: Math.round(from.y) }
  const key = (x: number, y: number) => `${x},${y}`
  const queue = [start]
  const seen = new Map<string, string | null>([[key(start.x, start.y), null]])
  let end: string | null = null
  while (queue.length) {
    const point = queue.shift()!
    if (Math.abs(point.x - target.x) + Math.abs(point.y - target.y) <= 1) {
      if (point.x === start.x && point.y === start.y && Math.hypot(from.x - target.x, from.y - target.y) > 1.25) return [start]
      end = key(point.x, point.y); break
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = point.x + dx, y = point.y + dy, id = key(x, y)
      if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || blocked.has(id) || seen.has(id)) continue
      seen.set(id, key(point.x, point.y)); queue.push({ x, y })
    }
  }
  const path: Game['player'][] = []
  while (end && seen.get(end) !== null) {
    const [x, y] = end.split(',').map(Number)
    path.unshift({ x, y }); end = seen.get(end) ?? null
  }
  return path
}

export function nearStation(game: Game, station: keyof typeof stations): boolean {
  const place = stations[station]
  return Math.hypot(game.player.x - place.x, game.player.y - place.y) <= 1.25
}

export function startTicket(game: Game, id: TicketId): Game {
  if (game.phase === 'finished' || game.tickets.some(ticket => ticket.status === 'active' || ticket.status === 'ready')) return game
  const chosen = game.tickets.find(ticket => ticket.id === id)
  if (!chosen || chosen.status !== 'waiting') return game
  return { ...game, tickets: game.tickets.map(ticket => ticket.id === id ? { ...ticket, status: 'active' } : ticket) }
}

const hints = {
  os: 'O indexador está usando quase toda a CPU. Encerrar o navegador apagaria o trabalho aberto da biblioteca.',
  database: 'A matrícula guarda aluno_id, que aponta para id na tabela de alunos. Essa é a relação necessária.',
}
const successFeedback = {
  os: 'Indexador encerrado: o uso da CPU caiu e o formulário da biblioteca continua aberto. Leve o chamado à entrega.',
  database: 'Relação criada: Lia aparece na turma 2A e Caio na 3B. Leve o chamado à entrega.',
}

export function submitAnswer(game: Game, id: TicketId, answer: string): Game {
  if (id !== 'os' && id !== 'database') return game
  const chosen = game.tickets.find(ticket => ticket.id === id)
  if (!chosen || chosen.status !== 'active' || game.phase === 'finished') return game
  const correct = chosen.answer === answer
  return {
    ...game,
    tickets: game.tickets.map(ticket => ticket.id === id ? {
      ...ticket,
      status: correct ? 'ready' as const : 'active' as const,
      feedback: correct ? successFeedback[id] : hints[id],
    } : ticket),
  }
}

export function applyHardwareToGame(game: Game, action: HardwareAction): Game {
  const active = game.tickets.find(ticket => (ticket.status === 'active' || ticket.status === 'ready') && ticket.station === 'hardware')
  if (!active || game.phase === 'finished') return game
  const caseId = active.id.replace('hardware-', '') as HardwareCaseId
  const state = applyHardwareAction(game.hardware[caseId], action)
  const ready = isHardwareResolved(state)
  return {
    ...game,
    hardware: { ...game.hardware, [caseId]: state },
    tickets: game.tickets.map(ticket => ticket.id === active.id ? { ...ticket, status: ready ? 'ready' : 'active', feedback: state.feedback } : ticket),
  }
}

export function resetHardwareInGame(game: Game, caseId: HardwareCaseId): Game {
  const id = `hardware-${caseId}` as TicketId
  const ticket = game.tickets.find(item => item.id === id)
  if (!ticket || (ticket.status !== 'active' && ticket.status !== 'ready')) return game
  return {
    ...game,
    hardware: { ...game.hardware, [caseId]: createHardwareCase(caseId) },
    tickets: game.tickets.map(item => item.id === id ? { ...item, status: 'active', feedback: '' } : item),
  }
}

export function finishTicket(game: Game, id: TicketId): Game {
  const chosen = game.tickets.find(ticket => ticket.id === id)
  if (!chosen || chosen.status !== 'ready' || game.phase === 'finished') return game
  const completed = game.completed + 1
  const order: TicketId[] = ['hardware-power', 'hardware-video', 'hardware-storage', 'hardware-psu', 'hardware-voltage', 'hardware-combined']
  const index = order.indexOf(id)
  const nextHardware = index >= 0 ? order[index + 1] ?? null : null
  return {
    ...game,
    completed,
    phase: completed === game.tickets.length ? 'finished' : 'playing',
    tickets: game.tickets.map(ticket => ticket.id === id ? { ...ticket, status: 'done' } : ticket.id === nextHardware ? { ...ticket, status: 'waiting' } : ticket),
  }
}
