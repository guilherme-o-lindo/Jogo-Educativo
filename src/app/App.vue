<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import HardwareWorkbench from '../hardware/HardwareWorkbench.vue'
import ComputerDesktop from '../consultation/ComputerDesktop.vue'
import PaperManuals from '../consultation/PaperManuals.vue'
import {
  applyHardwareToGame, createGame, finishTicket, movePlayer, nearStation, pathToStation,
  resetHardwareInGame, startTicket, stations, submitAnswer,
  type TicketId,
} from '../game/game'
import { type HardwareAction, type HardwareCaseId } from '../hardware/hardware'
import { loadSession, saveSession } from '../game/persistence'
import { replacementParts, replacementCables, cupboardAction } from '../hardware/stock'
import { partInfo, cableInfo } from '../hardware/hardware'

type Panel = 'balcão' | 'hardware' | 'os' | 'database' | 'entrega' | 'papeis' | 'computador' | 'armario' | null
const storage = typeof window === 'undefined' ? null : window.localStorage
const saved = storage ? loadSession(storage) : null
const game = ref(saved?.game ?? createGame())
const started = ref(saved?.started ?? false)
const panel = ref<Panel>(null)
const notice = ref(saved?.started ? 'Progresso recuperado. Continue o atendimento.' : 'Vá ao balcão para pegar o primeiro chamado.')
const dbLeft = ref<string | null>(null)
const dbRight = ref<string | null>(null)
const held = new Set<string>()
let frame = 0
let lastFrame = 0
let route: { x: number; y: number }[] = []
let preferredStation: Exclude<Panel, null> | null = null
const baseUrl = import.meta.env.BASE_URL
const activeTicket = computed(() => game.value.tickets.find(ticket => ticket.status === 'active' || ticket.status === 'ready'))
const waitingTickets = computed(() => game.value.tickets.filter(ticket => ticket.status === 'waiting'))
const hardwareCaseId = computed<HardwareCaseId | null>(() => {
  const id = activeTicket.value?.id
  return id?.startsWith('hardware-') ? id.replace('hardware-', '') as HardwareCaseId : null
})
const completedHardware = computed(() => game.value.tickets
  .filter(ticket => ticket.station === 'hardware' && ticket.status === 'done')
  .map(ticket => ({ ticket, journal: game.value.hardware[ticket.id.replace('hardware-', '') as HardwareCaseId].journal })))
const stationNames: Record<Exclude<Panel, null>, string> = {
  balcão: 'Balcão de chamados', hardware: 'Bancada de hardware', os: 'Terminal de processos',
  database: 'Terminal de dados', entrega: 'Entrega de soluções',
  papeis: 'Papéis e manuais', computador: 'Computador de consulta', armario: 'Armário de reposições',
}
const stationIcons: Record<Exclude<Panel, null>, string> = {
  balcão: 'counter', hardware: 'hardware', os: 'os', database: 'database', entrega: 'delivery',
  papeis: 'papers', computador: 'computer', armario: 'cupboard',
}
const stationOrder: Exclude<Panel, null>[] = ['balcão', 'hardware', 'os', 'database', 'entrega', 'papeis', 'computador', 'armario']
const stationHints: Record<Exclude<Panel, null>, string> = {
  balcão: 'Pegar chamado', hardware: 'Abrir bancada', os: 'Analisar processos',
  database: 'Relacionar tabelas', entrega: 'Entregar solução',
  papeis: 'Consultar manuais', computador: 'Pesquisar registros', armario: 'Buscar reposição',
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
function flushSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
  if (storage) saveSession(storage, { game: game.value, started: started.value })
}
watch([game, started], () => {
  if (saveTimer) return
  saveTimer = setTimeout(flushSave, 180)
}, { deep: true })

function startGame() {
  game.value = createGame()
  panel.value = null
  started.value = true
  dbLeft.value = null
  dbRight.value = null
  notice.value = 'Vá ao balcão para pegar o primeiro chamado.'
}

function move(dx: number, dy: number) {
  if (!started.value || game.value.phase === 'finished' || panel.value) return
  route = []
  preferredStation = null
  game.value = movePlayer(game.value, dx, dy)
}

function frameMove(time: number) {
  const dt = Math.min((time - (lastFrame || time)) / 1000, .05)
  lastFrame = time
  if (started.value && game.value.phase === 'playing' && !panel.value) {
    const dx = Number(held.has('arrowright') || held.has('d')) - Number(held.has('arrowleft') || held.has('a'))
    const dy = Number(held.has('arrowdown') || held.has('s')) - Number(held.has('arrowup') || held.has('w'))
    if (dx || dy) { route = []; preferredStation = null; game.value = movePlayer(game.value, dx * dt * 3 / Math.hypot(dx, dy), dy * dt * 3 / Math.hypot(dx, dy)) }
    else if (route.length) {
      const next = route[0]
      const deltaX = next.x - game.value.player.x, deltaY = next.y - game.value.player.y
      const distance = Math.hypot(deltaX, deltaY)
      if (distance < .08) route.shift()
      else game.value = movePlayer(game.value, deltaX / distance * Math.min(dt * 3, distance), deltaY / distance * Math.min(dt * 3, distance))
    }
  }
  frame = requestAnimationFrame(frameMove)
}

function routeTo(station: Exclude<Panel, null>) {
  if (!started.value || panel.value || game.value.phase === 'finished') return
  route = pathToStation(game.value.player, station)
  preferredStation = station
  notice.value = `Caminhando até ${stationNames[station]}. Ao chegar, use Interagir.`
}

function takeReplacement(item: Parameters<typeof cupboardAction>[0]) {
  if (!hardwareCaseId.value || activeTicket.value?.status !== 'active') { notice.value = 'Inicie um chamado de hardware para retirar uma reposição.'; return }
  handleHardwareAction(cupboardAction(item))
}

function nearbyStation(): Exclude<Panel, null> | undefined {
  return preferredStation && nearStation(game.value, preferredStation) ? preferredStation : stationOrder.find(station => nearStation(game.value, station))
}

function interact() {
  if (!started.value || game.value.phase === 'finished' || panel.value) return
  const nearby = nearbyStation()
  if (!nearby) {
    notice.value = 'Aproxime-se de uma bancada ou do balcão para interagir.'
    return
  }
  if (nearby === 'papeis' || nearby === 'computador' || nearby === 'armario') panel.value = nearby
  else if (nearby === 'balcão' && !activeTicket.value) panel.value = nearby
  else if (nearby === 'entrega' && activeTicket.value?.status === 'ready') panel.value = nearby
  else if (nearby === activeTicket.value?.station && activeTicket.value.status === 'active') panel.value = nearby
  else notice.value = nearby === 'balcão' ? 'Conclua o chamado atual antes de pegar outro.' : 'Esta bancada não é necessária agora.'
}

function takeTicket(id: TicketId) {
  game.value = startTicket(game.value, id)
  panel.value = null
  dbLeft.value = null
  dbRight.value = null
  const ticket = game.value.tickets.find(item => item.id === id)!
  notice.value = `Chamado recebido. Vá até ${stationNames[ticket.station]}.`
}

function answer(value: string) {
  if (!activeTicket.value) return
  const id = activeTicket.value.id
  game.value = submitAnswer(game.value, id, value)
  notice.value = game.value.tickets.find(item => item.id === id)?.feedback ?? ''
}

function linkFields() {
  if (dbLeft.value && dbRight.value) answer(`alunos.${dbLeft.value}=matriculas.${dbRight.value}`)
}

function handleHardwareAction(action: HardwareAction) {
  game.value = applyHardwareToGame(game.value, action)
  if (hardwareCaseId.value) notice.value = game.value.hardware[hardwareCaseId.value].feedback
  if (!('transient' in action && action.transient)) flushSave()
}

function resetHardware() {
  if (!hardwareCaseId.value) return
  game.value = resetHardwareInGame(game.value, hardwareCaseId.value)
  notice.value = 'Caso reiniciado. Comece uma nova sequência de testes.'
}

function deliver() {
  if (!activeTicket.value) return
  game.value = finishTicket(game.value, activeTicket.value.id)
  panel.value = null
  notice.value = game.value.phase === 'finished' ? 'Todos os chamados concluídos!' : 'Chamado entregue. Volte ao balcão.'
}

function handleKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && panel.value) {
    panel.value = null
    return
  }
  if (panel.value || event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return
  const key = event.key.toLowerCase()
  const directions: Record<string, [number, number]> = {
    arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1],
    arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0],
  }
  if (directions[key]) {
    event.preventDefault()
    held.add(key)
  } else if (key === 'e' || key === ' ') {
    if (event.target instanceof HTMLElement && event.target.tagName === 'BUTTON') return
    event.preventDefault()
    interact()
  }
}

function releaseKey(event: KeyboardEvent) { held.delete(event.key.toLowerCase()) }
function releaseAll() { held.clear() }
onMounted(() => { window.addEventListener('keydown', handleKey); window.addEventListener('keyup', releaseKey); window.addEventListener('blur', releaseAll); window.addEventListener('pointerup', releaseAll); window.addEventListener('pointercancel', releaseAll); frame = requestAnimationFrame(frameMove) })
onUnmounted(() => { window.removeEventListener('keydown', handleKey); window.removeEventListener('keyup', releaseKey); window.removeEventListener('blur', releaseAll); window.removeEventListener('pointerup', releaseAll); window.removeEventListener('pointercancel', releaseAll); cancelAnimationFrame(frame); flushSave() })
</script>

<template>
  <div class="app-shell">
    <header class="topbar" :inert="panel === 'hardware'">
      <div class="brand"><span class="brand-mark" aria-hidden="true">✦</span><span>OFICINA <strong>TI</strong></span></div>
      <div class="topbar-note">Plantão na escola <span class="topbar-separator">/</span> Jogo educativo</div>
      <div class="topbar-status"><span class="status-light"></span> Sistema em operação</div>
    </header>
    <main class="main-layout" :inert="panel === 'hardware'">
      <section class="game-column" aria-label="Área do jogo">
        <div class="headline"><div><h1>O plantão continua<span class="period">.</span></h1><p>Oito chamados. Investigue cada sintoma no seu ritmo.</p></div><div class="level-tag">OFICINA <span>·</span> ESCOLA TÉCNICA</div></div>
        <div class="hud" aria-label="Estado da partida"><div class="hud-item"><span class="hud-label">CHAMADOS RESOLVIDOS</span><strong>{{ game.completed }} <small>/ 8</small></strong></div><div class="hud-item"><span class="hud-label">AGUARDANDO</span><strong>{{ waitingTickets.length }}</strong></div><div class="hud-item"><span class="hud-label">RITMO</span><strong class="hud-word">Sem relógio</strong></div><div class="hud-progress" aria-hidden="true"><span :style="{ width: `${(game.completed / 8) * 100}%` }"></span></div></div>
        <div class="map-frame">
          <div class="map-topline"><span>LABORATÓRIO CENTRAL</span><span>SALA 07 — ESCOLA TÉCNICA</span></div>
          <div class="map" role="group" aria-label="Mapa da oficina de TI com balcão, bancadas e personagem">
            <div class="floor-grid" aria-hidden="true"></div><div class="map-wall top"></div><div class="map-wall bottom"></div>
            <div class="map-decoration plant plant-one" aria-hidden="true"></div><div class="map-decoration plant plant-two" aria-hidden="true"></div><div class="map-decoration table" aria-hidden="true"><span></span></div>
            <button v-for="station in stationOrder" :key="station" class="station" :class="[station, { nearby: started && nearStation(game, station) }]" :style="{ '--x': stations[station].x, '--y': stations[station].y }" :aria-label="`Ir até ${stationNames[station]}`" :disabled="!started || game.phase === 'finished'" @click="routeTo(station)"><span class="station-object"><img :src="`${baseUrl}assets/${stationIcons[station]}.svg`" alt="" /></span><span class="station-name">{{ stationNames[station] }}</span></button>
            <div class="player" :style="{ '--x': game.player.x, '--y': game.player.y }" aria-hidden="true"><span class="player-shadow"></span><img :src="`${baseUrl}assets/player.svg`" alt="" /></div>
            <div v-if="started && game.phase === 'playing' && nearbyStation()" class="interaction-tip">E <span>{{ stationHints[nearbyStation()!] }}</span></div>
          </div>
          <div class="map-bottomline"><span>W A S D / SETAS <b>mover</b></span><span>E / ESPAÇO <b>interagir</b></span><span>CLIQUE <b>caminhar</b></span></div>
          <div v-if="!started" class="overlay intro-overlay"><div class="overlay-card"><div class="overlay-symbol">✦</div><h2>Bem-vindo ao plantão!</h2><p>Investigue oito chamados da escola. Na bancada de hardware, experimente peças, cabos e testes de partida. Seu progresso fica salvo neste navegador.</p><button class="primary-button" @click="startGame">Começar plantão</button><span class="overlay-note">Explore sem limite de tempo</span></div></div>
          <div v-else-if="game.phase === 'finished'" class="overlay finish-overlay"><div class="overlay-card"><div class="overlay-symbol">★</div><h2>Plantão concluído!</h2><p>Você resolveu os <strong>8 chamados</strong> e registrou os diagnósticos das seis máquinas.</p><p class="learning-note">Conceitos da fase: energia, memória, vídeo, SATA, processos e relação entre tabelas.</p><button class="primary-button" @click="startGame">Iniciar nova partida</button></div></div>
        </div>
        <nav class="mobile-stations" aria-label="Estações da sala"><button v-for="station in stationOrder" :key="station" :disabled="!started || game.phase === 'finished'" @click="routeTo(station)">{{ stationNames[station] }}</button></nav>
        <div class="message-strip" role="status"><span class="message-icon">i</span>{{ notice }}</div>
        <div class="mobile-controls" aria-label="Controles de movimento"><div class="dpad"><button aria-label="Mover para cima" @pointerdown="held.add('arrowup')" @pointerup="held.delete('arrowup')" @pointercancel="held.delete('arrowup')">▲</button><div><button aria-label="Mover para a esquerda" @pointerdown="held.add('arrowleft')" @pointerup="held.delete('arrowleft')" @pointercancel="held.delete('arrowleft')">◀</button><button aria-label="Mover para baixo" @pointerdown="held.add('arrowdown')" @pointerup="held.delete('arrowdown')" @pointercancel="held.delete('arrowdown')">▼</button><button aria-label="Mover para a direita" @pointerdown="held.add('arrowright')" @pointerup="held.delete('arrowright')" @pointercancel="held.delete('arrowright')">▶</button></div></div><button class="interact-button" @click="interact">Interagir</button></div>
      </section>
      <aside class="side-column" aria-label="Painel de chamados">
        <div class="side-heading"><div><h2>Central de chamados</h2><p>Escolha uma demanda e siga as pistas.</p></div><span class="ticket-count">{{ waitingTickets.length + (activeTicket ? 1 : 0) }}</span></div>
        <div v-if="panel && panel !== 'hardware'" class="task-panel">
          <div class="task-panel-header"><div><span class="panel-kicker">EM ATENDIMENTO</span><h3>{{ stationNames[panel] }}</h3></div><button class="close-button" aria-label="Fechar painel" @click="panel = null">×</button></div>
          <template v-if="panel === 'balcão'"><p class="panel-intro">Escolha um chamado para iniciar o atendimento.</p><div v-if="waitingTickets.length === 0" class="empty-state">Nenhum chamado liberado agora. Conclua o caso atual para liberar o próximo.</div><button v-for="ticket in waitingTickets" :key="ticket.id" class="ticket-choice" @click="takeTicket(ticket.id)"><strong>{{ ticket.title }}</strong><span>{{ ticket.requester }} · {{ ticket.topic }}</span></button></template>
          <template v-else-if="panel === 'papeis'"><PaperManuals /></template>
          <template v-else-if="panel === 'computador'"><ComputerDesktop /></template>
          <template v-else-if="panel === 'armario'"><p class="panel-intro">Reposições gratuitas e ilimitadas. Retire o item necessário para o chamado ativo.</p><button v-for="part in replacementParts" :key="part" class="ticket-choice" @click="takeReplacement(part)">{{ partInfo[part].name }}</button><button class="ticket-choice" @click="takeReplacement('psu')">Fonte ATX de reposição</button><button v-for="cable in replacementCables" :key="cable" class="ticket-choice" @click="takeReplacement(cable)">{{ cableInfo[cable].name }}</button></template>
          <template v-else-if="panel === 'entrega' && activeTicket"><p class="panel-intro">Você concluiu <strong>{{ activeTicket.title }}</strong>. Entregue a solução para encerrar o chamado.</p><button class="primary-button full" @click="deliver">Entregar solução</button></template>
          <template v-else-if="activeTicket"><p class="panel-intro"><strong>{{ activeTicket.title }}</strong><br />{{ activeTicket.requester }}</p>
            <template v-if="panel === 'os'"><p class="task-question">Libere a CPU sem perder o formulário que está aberto.</p><div class="process-table"><div class="table-header"><span>PROCESSO</span><span>CPU</span><span>AÇÃO</span></div><div><span>Navegador — formulário aberto</span><b>8%</b><button :disabled="activeTicket.status === 'ready'" @click="answer('navegador')">Encerrar</button></div><div class="hot-row"><span>Indexador — travado</span><b>87%</b><button :disabled="activeTicket.status === 'ready'" @click="answer('indexador')">Encerrar</button></div><div><span>Áudio do sistema</span><b>2%</b><button :disabled="activeTicket.status === 'ready'" @click="answer('audio')">Encerrar</button></div></div></template>
            <template v-else-if="panel === 'database'"><p class="task-question">Selecione um campo de cada tabela para conectar os estudantes às turmas.</p><div class="db-tables"><div><strong>alunos</strong><button :class="{ selected: dbLeft === 'id' }" :disabled="activeTicket.status === 'ready'" @click="dbLeft = 'id'">id <small>14, 27</small></button><button :class="{ selected: dbLeft === 'nome' }" :disabled="activeTicket.status === 'ready'" @click="dbLeft = 'nome'">nome <small>Lia, Caio</small></button></div><div><strong>matriculas</strong><button :class="{ selected: dbRight === 'aluno_id' }" :disabled="activeTicket.status === 'ready'" @click="dbRight = 'aluno_id'">aluno_id <small>14, 27</small></button><button :class="{ selected: dbRight === 'turma' }" :disabled="activeTicket.status === 'ready'" @click="dbRight = 'turma'">turma <small>2A, 3B</small></button></div></div><div class="relation-preview">{{ dbLeft ? `alunos.${dbLeft}` : 'Escolha um campo' }} <span>↔</span> {{ dbRight ? `matriculas.${dbRight}` : 'Escolha outro campo' }}</div><button class="primary-button full task-submit" :disabled="!dbLeft || !dbRight || activeTicket.status === 'ready'" @click="linkFields">Criar relação</button></template>
            <div v-if="activeTicket.feedback" class="feedback" :class="{ success: activeTicket.status === 'ready' }" role="status">{{ activeTicket.feedback }}</div><button v-if="activeTicket.status === 'ready'" class="secondary-button" @click="panel = null">Ir para a entrega</button>
          </template>
        </div>
        <template v-else>
          <div v-if="activeTicket" class="current-ticket"><span class="section-label">CHAMADO ATUAL</span><div class="current-ticket-title"><span class="topic-square"></span><h3>{{ activeTicket.title }}</h3></div><p>{{ activeTicket.requester }}</p><div class="ticket-action">{{ activeTicket.status === 'ready' ? 'Vá até a entrega' : `Vá até ${stationNames[activeTicket.station]}` }}</div></div>
          <div class="queue-heading"><span>FILA DE ATENDIMENTO</span><span>{{ waitingTickets.length }} aguardando</span></div>
          <div class="ticket-list"><div v-for="ticket in game.tickets" :key="ticket.id" class="ticket-item" :class="ticket.status"><span class="ticket-dot"></span><div><strong>{{ ticket.title }}</strong><small>{{ ticket.topic }} · {{ ticket.requester }}</small></div><span class="ticket-state">{{ ticket.status === 'done' ? 'OK' : ticket.status === 'locked' ? 'DEPOIS' : ticket.status === 'waiting' ? 'NOVO' : 'ATIVO' }}</span></div></div>
          <div v-if="completedHardware.length" class="diagnosis-archive"><span class="section-label">DIAGNÓSTICOS CONCLUÍDOS</span><details v-for="item in completedHardware" :key="item.ticket.id"><summary>{{ item.ticket.title }}</summary><ol><li v-for="(entry, index) in item.journal" :key="index">{{ entry }}</li></ol></details></div>
          <div class="how-to"><span class="section-label">COMO JOGAR</span><p>1. Pegue um chamado no balcão.<br />2. Investigue na bancada indicada.<br />3. Entregue a solução. O próximo caso de hardware será liberado.</p></div>
        </template>
      </aside>
    </main>
    <footer class="footer" :inert="panel === 'hardware'"><span>OFICINA TI © PROJETO EDUCACIONAL</span><span>Oito chamados, três áreas da informática.</span></footer>
    <HardwareWorkbench v-if="panel === 'hardware' && hardwareCaseId" :state="game.hardware[hardwareCaseId]" :case-id="hardwareCaseId" :ready="activeTicket?.status === 'ready'" @action="handleHardwareAction" @reset="resetHardware" @close="panel = null" />
  </div>
</template>
