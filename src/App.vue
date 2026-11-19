<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  DURATION, advanceGame, createGame, finishTicket, movePlayer,
  nearStation, startTicket, stations, submitAnswer,
  type TicketId,
} from './game'

type Panel = 'balcão' | 'hardware' | 'os' | 'database' | 'entrega' | null

const game = ref(createGame())
const baseUrl = import.meta.env.BASE_URL
const started = ref(false)
const panel = ref<Panel>(null)
const notice = ref('Vá ao balcão para pegar o primeiro chamado.')
const hardwareSelection = ref<string | null>(null)
const dbLeft = ref<string | null>(null)
const dbRight = ref<string | null>(null)
const activeTicket = computed(() => game.value.tickets.find(ticket => ticket.status === 'active' || ticket.status === 'ready'))
const waitingTickets = computed(() => game.value.tickets.filter(ticket => ticket.status === 'waiting'))
const remaining = computed(() => DURATION - game.value.elapsed)
const formattedTime = computed(() => `${String(Math.floor(remaining.value / 60)).padStart(2, '0')}:${String(remaining.value % 60).padStart(2, '0')}`)
const nextArrival = computed(() => game.value.tickets.find(ticket => ticket.status === 'locked'))
const stationNames: Record<Exclude<Panel, null>, string> = {
  balcão: 'Balcão de chamados', hardware: 'Bancada de hardware', os: 'Terminal de processos',
  database: 'Terminal de dados', entrega: 'Entrega de soluções',
}
const stationIcons: Record<Exclude<Panel, null>, string> = {
  balcão: 'counter', hardware: 'hardware', os: 'os', database: 'database', entrega: 'delivery',
}
const stationOrder: Exclude<Panel, null>[] = ['balcão', 'hardware', 'os', 'database', 'entrega']
const stationHints: Record<Exclude<Panel, null>, string> = {
  balcão: 'Pegar chamado', hardware: 'Diagnosticar PC', os: 'Analisar processos',
  database: 'Relacionar tabelas', entrega: 'Entregar solução',
}

let timer: number | undefined

function startGame() {
  game.value = createGame()
  panel.value = null
  started.value = true
  hardwareSelection.value = null
  dbLeft.value = null
  dbRight.value = null
  notice.value = 'Vá ao balcão para pegar o primeiro chamado.'
}

function move(dx: number, dy: number) {
  if (!started.value || game.value.phase === 'finished' || panel.value) return
  game.value = movePlayer(game.value, dx, dy)
}

function interact() {
  if (!started.value || game.value.phase === 'finished' || panel.value) return
  const nearby = stationOrder.find(station => nearStation(game.value, station))
  if (!nearby) {
    notice.value = 'Aproxime-se de uma bancada ou do balcão para interagir.'
    return
  }
  if (nearby === 'balcão' && !activeTicket.value) {
    panel.value = nearby
  } else if (nearby === 'entrega' && activeTicket.value?.status === 'ready') {
    panel.value = nearby
  } else if (nearby === activeTicket.value?.station && activeTicket.value.status === 'active') {
    panel.value = nearby
  } else {
    notice.value = nearby === 'balcão' ? 'Conclua o chamado atual antes de pegar outro.' : 'Esta bancada não é necessária agora.'
  }
}

function takeTicket(id: TicketId) {
  game.value = startTicket(game.value, id)
  panel.value = null
  hardwareSelection.value = null
  dbLeft.value = null
  dbRight.value = null
  const ticket = game.value.tickets.find(item => item.id === id)!
  notice.value = `Chamado recebido. Vá até ${stationNames[ticket.station]}.`
}

function answer(value: string) {
  if (!activeTicket.value) return
  game.value = submitAnswer(game.value, activeTicket.value.id, value)
  notice.value = game.value.tickets.find(item => item.id === activeTicket.value?.id)?.feedback ?? ''
}

function linkFields() {
  if (!dbLeft.value || !dbRight.value) return
  answer(`alunos.${dbLeft.value}=matriculas.${dbRight.value}`)
}

function deliver() {
  if (!activeTicket.value) return
  const id = activeTicket.value.id
  game.value = finishTicket(game.value, id)
  panel.value = null
  notice.value = game.value.phase === 'finished' ? 'Plantão concluído!' : 'Chamado resolvido! Volte ao balcão.'
}

function handleKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && panel.value) {
    panel.value = null
    return
  }
  if (event.target instanceof HTMLElement && event.target.tagName === 'INPUT') return
  const key = event.key.toLowerCase()
  const directions: Record<string, [number, number]> = {
    arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1],
    arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0],
  }
  if (directions[key]) {
    event.preventDefault()
    move(...directions[key])
  } else if (key === 'e' || key === ' ') {
    if (event.target instanceof HTMLElement && event.target.tagName === 'BUTTON') return
    event.preventDefault()
    interact()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKey)
  timer = window.setInterval(() => {
    if (!started.value || game.value.phase !== 'playing') return
    game.value = advanceGame(game.value, 1)
    if (game.value.phase === 'finished') panel.value = null
  }, 1000)
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleKey)
  window.clearInterval(timer)
})
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="brand"><span class="brand-mark" aria-hidden="true">✦</span><span>OFICINA <strong>TI</strong></span></div>
      <div class="topbar-note">Plantão na escola <span class="topbar-separator">/</span> Jogo educativo</div>
      <div class="topbar-status"><span class="status-light"></span> Sistema em operação</div>
    </header>

    <main class="main-layout">
      <section class="game-column" aria-label="Área do jogo">
        <div class="headline">
          <div>
            <h1>O plantão começou<span class="period">.</span></h1>
            <p>Três chamados. Uma escola inteira contando com você.</p>
          </div>
          <div class="level-tag">FASE 1 <span>·</span> TURNO DA MANHÃ</div>
        </div>

        <div class="hud" aria-label="Estado da partida">
          <div class="hud-item"><span class="hud-label">TEMPO RESTANTE</span><strong :class="{ urgent: remaining <= 45 }">{{ formattedTime }}</strong></div>
          <div class="hud-item"><span class="hud-label">CHAMADOS RESOLVIDOS</span><strong>{{ game.completed }} <small>/ 3</small></strong></div>
          <div class="hud-item"><span class="hud-label">PONTUAÇÃO</span><strong>{{ game.score }}</strong></div>
          <div class="hud-progress" aria-hidden="true"><span :style="{ width: `${(game.elapsed / DURATION) * 100}%` }"></span></div>
        </div>

        <div class="map-frame">
          <div class="map-topline"><span>LABORATÓRIO CENTRAL</span><span>SALA 07 — ESCOLA TÉCNICA</span></div>
          <div class="map" role="img" aria-label="Mapa da oficina de TI com balcão, bancadas e personagem">
            <div class="floor-grid" aria-hidden="true"></div>
            <div class="map-wall top"></div><div class="map-wall bottom"></div>
            <div class="map-decoration plant plant-one" aria-hidden="true"></div>
            <div class="map-decoration plant plant-two" aria-hidden="true"></div>
            <div class="map-decoration table" aria-hidden="true"><span></span></div>
            <div v-for="station in stationOrder" :key="station" class="station"
              :class="[station, { nearby: started && nearStation(game, station) }]"
              :style="{ '--x': stations[station].x, '--y': stations[station].y }">
              <div class="station-object"><img :src="`${baseUrl}assets/${stationIcons[station]}.svg`" alt="" /></div>
              <span class="station-name">{{ stationNames[station] }}</span>
            </div>
            <div class="player" :style="{ '--x': game.player.x, '--y': game.player.y }" aria-hidden="true">
              <span class="player-shadow"></span><img :src="`${baseUrl}assets/player.svg`" alt="" />
            </div>
            <div v-if="started && game.phase === 'playing' && stationOrder.some(station => nearStation(game, station))" class="interaction-tip">E <span>{{ stationHints[stationOrder.find(station => nearStation(game, station))!] }}</span></div>
          </div>
          <div class="map-bottomline"><span>W A S D / SETAS <b>mover</b></span><span>E / ESPAÇO <b>interagir</b></span><span>ESC <b>fechar</b></span></div>

          <div v-if="!started" class="overlay intro-overlay">
            <div class="overlay-card">
              <div class="overlay-symbol">✦</div>
              <h2>Bem-vindo ao plantão!</h2>
              <p>Resolva chamados de hardware, sistema operacional e banco de dados. Encontre as bancadas, investigue as pistas e entregue as soluções antes do tempo acabar.</p>
              <button class="primary-button" @click="startGame">Começar plantão</button>
              <span class="overlay-note">Uma partida de aproximadamente 5 minutos</span>
            </div>
          </div>
          <div v-else-if="game.phase === 'finished'" class="overlay finish-overlay">
            <div class="overlay-card">
              <div class="overlay-symbol">★</div>
              <h2>{{ game.completed === 3 ? 'Plantão concluído!' : 'Fim do expediente!' }}</h2>
              <p>Você resolveu <strong>{{ game.completed }} de 3 chamados</strong> e marcou <strong>{{ game.score }} pontos</strong>.</p>
              <p class="learning-note">Conceitos da fase: diagnóstico de memória, uso de CPU por processos e relação entre tabelas.</p>
              <button class="primary-button" @click="startGame">Jogar novamente</button>
            </div>
          </div>
        </div>

        <div class="message-strip" role="status"><span class="message-icon">i</span>{{ notice }}</div>
        <div class="mobile-controls" aria-label="Controles de movimento">
          <div class="dpad"><button aria-label="Mover para cima" @click="move(0, -1)">▲</button><div><button aria-label="Mover para a esquerda" @click="move(-1, 0)">◀</button><button aria-label="Mover para baixo" @click="move(0, 1)">▼</button><button aria-label="Mover para a direita" @click="move(1, 0)">▶</button></div></div>
          <button class="interact-button" @click="interact">Interagir</button>
        </div>
      </section>

      <aside class="side-column" aria-label="Painel de chamados">
        <div class="side-heading"><div><h2>Central de chamados</h2><p>Acompanhe as demandas da escola.</p></div><span class="ticket-count">{{ waitingTickets.length + (activeTicket ? 1 : 0) }}</span></div>

        <div v-if="panel" class="task-panel">
          <div class="task-panel-header"><div><span class="panel-kicker">EM ATENDIMENTO</span><h3>{{ stationNames[panel] }}</h3></div><button class="close-button" aria-label="Fechar painel" @click="panel = null">×</button></div>
          <template v-if="panel === 'balcão'">
            <p class="panel-intro">Escolha um chamado para iniciar o atendimento.</p>
            <div v-if="waitingTickets.length === 0" class="empty-state">Nenhum chamado novo por enquanto. Volte em alguns segundos.</div>
            <button v-for="ticket in waitingTickets" :key="ticket.id" class="ticket-choice" @click="takeTicket(ticket.id)"><strong>{{ ticket.title }}</strong><span>{{ ticket.requester }} · {{ ticket.topic }}</span></button>
          </template>
          <template v-else-if="panel === 'entrega' && activeTicket">
            <p class="panel-intro">Você concluiu o diagnóstico de <strong>{{ activeTicket.title }}</strong>. Entregue a solução para encerrar o chamado.</p>
            <button class="primary-button full" @click="deliver">Entregar solução</button>
          </template>
          <template v-else-if="activeTicket">
            <p class="panel-intro"><strong>{{ activeTicket.title }}</strong><br />{{ activeTicket.requester }}</p>
            <template v-if="panel === 'hardware'">
              <div class="evidence"><span>SINTOMAS OBSERVADOS</span><p>O computador liga, mas não mostra imagem. O monitor e o cabo funcionam em outra máquina. Ao ligar, há bipes repetidos.</p></div>
              <p class="task-question">Selecione o componente para reencaixar e teste a inicialização.</p>
              <div class="hardware-board" aria-label="Componentes do computador">
                <button class="component cpu" :class="{ selected: hardwareSelection === 'cpu' }" :disabled="activeTicket.status === 'ready'" @click="hardwareSelection = 'cpu'">CPU</button>
                <button class="component ram" :class="{ selected: hardwareSelection === 'ram' }" :disabled="activeTicket.status === 'ready'" @click="hardwareSelection = 'ram'">RAM</button>
                <button class="component monitor" :class="{ selected: hardwareSelection === 'monitor' }" :disabled="activeTicket.status === 'ready'" @click="hardwareSelection = 'monitor'">MONITOR</button>
                <span class="board-trace one"></span><span class="board-trace two"></span>
              </div>
              <button class="primary-button full task-submit" :disabled="!hardwareSelection || activeTicket.status === 'ready'" @click="answer(hardwareSelection!)">Reencaixar e testar</button>
            </template>
            <template v-else-if="panel === 'os'">
              <p class="task-question">Libere a CPU sem perder o formulário que está aberto.</p>
              <div class="process-table"><div class="table-header"><span>PROCESSO</span><span>CPU</span><span>AÇÃO</span></div><div><span>Navegador — formulário aberto</span><b>8%</b><button :disabled="activeTicket.status === 'ready'" @click="answer('navegador')">Encerrar</button></div><div class="hot-row"><span>Indexador — travado</span><b>87%</b><button :disabled="activeTicket.status === 'ready'" @click="answer('indexador')">Encerrar</button></div><div><span>Áudio do sistema</span><b>2%</b><button :disabled="activeTicket.status === 'ready'" @click="answer('audio')">Encerrar</button></div></div>
            </template>
            <template v-else-if="panel === 'database'">
              <p class="task-question">Selecione um campo de cada tabela para conectar os estudantes às turmas.</p>
              <div class="db-tables"><div><strong>alunos</strong><button :class="{ selected: dbLeft === 'id' }" :disabled="activeTicket.status === 'ready'" @click="dbLeft = 'id'">id <small>14, 27</small></button><button :class="{ selected: dbLeft === 'nome' }" :disabled="activeTicket.status === 'ready'" @click="dbLeft = 'nome'">nome <small>Lia, Caio</small></button></div><div><strong>matriculas</strong><button :class="{ selected: dbRight === 'aluno_id' }" :disabled="activeTicket.status === 'ready'" @click="dbRight = 'aluno_id'">aluno_id <small>14, 27</small></button><button :class="{ selected: dbRight === 'turma' }" :disabled="activeTicket.status === 'ready'" @click="dbRight = 'turma'">turma <small>2A, 3B</small></button></div></div>
              <div class="relation-preview">{{ dbLeft ? `alunos.${dbLeft}` : 'Escolha um campo' }} <span>↔</span> {{ dbRight ? `matriculas.${dbRight}` : 'Escolha outro campo' }}</div>
              <button class="primary-button full task-submit" :disabled="!dbLeft || !dbRight || activeTicket.status === 'ready'" @click="linkFields">Criar relação</button>
            </template>
            <div v-if="activeTicket.feedback" class="feedback" :class="{ success: activeTicket.status === 'ready' }" role="status">{{ activeTicket.feedback }}</div>
            <button v-if="activeTicket.status === 'ready'" class="secondary-button" @click="panel = null">Ir para a entrega</button>
          </template>
        </div>

        <template v-else>
          <div v-if="activeTicket" class="current-ticket"><span class="section-label">CHAMADO ATUAL</span><div class="current-ticket-title"><span class="topic-square"></span><h3>{{ activeTicket.title }}</h3></div><p>{{ activeTicket.requester }}</p><div class="ticket-action">{{ activeTicket.status === 'ready' ? 'Vá até a entrega' : `Vá até ${stationNames[activeTicket.station]}` }}</div></div>
          <div class="queue-heading"><span>FILA DE ATENDIMENTO</span><span>{{ waitingTickets.length }} aguardando</span></div>
          <div class="ticket-list">
            <div v-for="ticket in game.tickets" :key="ticket.id" class="ticket-item" :class="ticket.status"><span class="ticket-dot"></span><div><strong>{{ ticket.title }}</strong><small>{{ ticket.topic }} · {{ ticket.requester }}</small></div><span class="ticket-state">{{ ticket.status === 'done' ? 'OK' : ticket.status === 'locked' ? 'EM BREVE' : ticket.status === 'waiting' ? 'NOVO' : 'ATIVO' }}</span></div>
          </div>
          <div v-if="nextArrival && started && game.phase === 'playing'" class="next-call">Próximo chamado em <strong>{{ Math.max(0, nextArrival.arrival - game.elapsed) }}s</strong></div>
          <div class="how-to"><span class="section-label">COMO JOGAR</span><p>1. Pegue um chamado no balcão.<br />2. Resolva a tarefa na bancada indicada.<br />3. Entregue a solução para pontuar.</p></div>
        </template>
      </aside>
    </main>
    <footer class="footer"><span>OFICINA TI © PROJETO EDUCACIONAL</span><span>Uma partida, três conceitos, muitas descobertas.</span></footer>
  </div>
</template>
