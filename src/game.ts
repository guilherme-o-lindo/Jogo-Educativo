export type TicketId = 'hardware' | 'os' | 'database'
export type TicketStatus = 'locked' | 'waiting' | 'active' | 'ready' | 'done'
export type Phase = 'playing' | 'finished'

export interface Ticket {
  id: TicketId
  title: string
  requester: string
  topic: string
  arrival: number
  station: 'hardware' | 'os' | 'database'
  answer: string
  status: TicketStatus
  attempts: number
  feedback: string
}

export interface Game {
  phase: Phase
  elapsed: number
  score: number
  completed: number
  player: { x: number; y: number }
  tickets: Ticket[]
}

export const WIDTH = 14
export const HEIGHT = 9
export const DURATION = 300

export const stations = {
  balcão: { x: 1, y: 6 },
  hardware: { x: 3, y: 2 },
  os: { x: 7, y: 2 },
  database: { x: 11, y: 2 },
  entrega: { x: 12, y: 6 },
} as const

const blocked = new Set(['3,2', '7,2', '11,2', '1,6', '12,6', '6,4'])

const initialTickets: Omit<Ticket, 'status' | 'attempts' | 'feedback'>[] = [
  {
    id: 'hardware',
    title: 'Monitor apagado no laboratório',
    requester: 'Laboratório de informática',
    topic: 'Hardware',
    arrival: 0,
    station: 'hardware',
    answer: 'ram',
  },
  {
    id: 'os',
    title: 'Computador da biblioteca lento',
    requester: 'Biblioteca',
    topic: 'Sistema operacional',
    arrival: 45,
    station: 'os',
    answer: 'indexador',
  },
  {
    id: 'database',
    title: 'Relatório de turmas incompleto',
    requester: 'Secretaria',
    topic: 'Banco de dados',
    arrival: 90,
    station: 'database',
    answer: 'alunos.id=matriculas.aluno_id',
  },
]

export function createGame(): Game {
  return {
    phase: 'playing',
    elapsed: 0,
    score: 0,
    completed: 0,
    player: { x: 6, y: 5 },
    tickets: initialTickets.map(ticket => ({
      ...ticket,
      status: ticket.arrival === 0 ? 'waiting' : 'locked',
      attempts: 0,
      feedback: '',
    })),
  }
}

export function advanceGame(game: Game, seconds: number): Game {
  if (game.phase === 'finished' || seconds <= 0) return game
  const elapsed = Math.min(DURATION, game.elapsed + seconds)
  const tickets = game.tickets.map(ticket =>
    ticket.status === 'locked' && elapsed >= ticket.arrival
      ? { ...ticket, status: 'waiting' as const }
      : ticket,
  )
  return { ...game, elapsed, tickets, phase: elapsed >= DURATION ? 'finished' : 'playing' }
}

export function movePlayer(game: Game, dx: number, dy: number): Game {
  if (game.phase === 'finished' || Math.abs(dx) + Math.abs(dy) !== 1) return game
  const x = game.player.x + dx
  const y = game.player.y + dy
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT || blocked.has(`${x},${y}`)) return game
  return { ...game, player: { x, y } }
}

export function nearStation(game: Game, station: keyof typeof stations): boolean {
  const place = stations[station]
  return Math.abs(game.player.x - place.x) + Math.abs(game.player.y - place.y) <= 1
}

export function startTicket(game: Game, id: TicketId): Game {
  if (game.phase === 'finished' || game.tickets.some(ticket => ticket.status === 'active' || ticket.status === 'ready')) return game
  const chosen = game.tickets.find(ticket => ticket.id === id)
  if (!chosen || chosen.status !== 'waiting') return game
  return { ...game, tickets: game.tickets.map(ticket => ticket.id === id ? { ...ticket, status: 'active' } : ticket) }
}

const hints: Record<TicketId, string> = {
  hardware: 'O diagnóstico aponta para a memória: o computador liga, mas não conclui a inicialização. Verifique o encaixe da RAM.',
  os: 'O indexador está usando quase toda a CPU. Encerrar o navegador apagaria o trabalho aberto da biblioteca.',
  database: 'A matrícula guarda aluno_id, que aponta para id na tabela de alunos. Essa é a relação necessária.',
}

const successFeedback: Record<TicketId, string> = {
  hardware: 'RAM reencaixada: o computador concluiu a inicialização e voltou a mostrar imagem. Leve o chamado à entrega.',
  os: 'Indexador encerrado: o uso da CPU caiu e o formulário da biblioteca continua aberto. Leve o chamado à entrega.',
  database: 'Relação criada: Lia aparece na turma 2A e Caio na 3B. Leve o chamado à entrega.',
}

export function submitAnswer(game: Game, id: TicketId, answer: string): Game {
  if (game.phase === 'finished') return game
  const chosen = game.tickets.find(ticket => ticket.id === id)
  if (!chosen || chosen.status !== 'active') return game
  const correct = chosen.answer === answer
  return {
    ...game,
    tickets: game.tickets.map(ticket => ticket.id === id ? {
      ...ticket,
      status: correct ? 'ready' as const : 'active' as const,
      attempts: ticket.attempts + (correct ? 0 : 1),
      feedback: correct ? successFeedback[id] : hints[id],
    } : ticket),
  }
}

export function finishTicket(game: Game, id: TicketId): Game {
  const chosen = game.tickets.find(ticket => ticket.id === id)
  if (!chosen || chosen.status !== 'ready' || game.phase === 'finished') return game
  const completed = game.completed + 1
  return {
    ...game,
    completed,
    score: game.score + 100 + Math.max(0, Math.floor((DURATION - game.elapsed) / 10)) - Math.min(30, chosen.attempts * 10),
    phase: completed === game.tickets.length ? 'finished' : 'playing',
    tickets: game.tickets.map(ticket => ticket.id === id ? { ...ticket, status: 'done' } : ticket),
  }
}
