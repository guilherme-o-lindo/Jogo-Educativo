<script setup lang="ts">
import { computed, ref } from 'vue'
import { articles, externalSearchUrl, searchArticles, type Article } from './documents'

const query = ref('')
const windowName = ref<'arquivos' | 'pesquisa' | null>(null)
const folder = ref<'manuais' | 'registros'>('manuais')
const article = ref<Article | null>(null)
const results = computed(() => searchArticles(query.value))
const files = computed(() => articles.filter(item => item.category === (folder.value === 'manuais' ? 'manual' : 'registro')))
function openWebSearch() {
  if (!query.value.trim()) return
  window.open(externalSearchUrl(query.value), '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div class="school-computer" aria-label="Desktop simulado da escola">
    <div class="computer-screen">
      <div class="desktop-icons">
        <button @click="windowName = 'arquivos'; folder = 'manuais'; article = null"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M3 9h10l3 3h13v16H3zM3 9V5h12l3 4" fill="none" stroke="currentColor" stroke-width="3"/></svg> Arquivos</button>
        <button @click="windowName = 'arquivos'; folder = 'registros'; article = null"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 3h20v26H6zM10 11h12M10 17h12M10 23h8" fill="none" stroke="currentColor" stroke-width="3"/></svg> Registros</button>
        <button @click="windowName = 'pesquisa'; article = null"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="14" cy="14" r="9" fill="none" stroke="currentColor" stroke-width="3"/><path d="m21 21 8 8" fill="none" stroke="currentColor" stroke-width="3"/></svg> Pesquisa local</button>
      </div>
      <section v-if="windowName" class="desktop-window" :aria-label="windowName === 'arquivos' ? 'Arquivos da escola' : 'Pesquisa local'">
        <div class="desktop-titlebar"><strong>{{ windowName === 'arquivos' ? 'Arquivos da escola' : 'Pesquisa local' }}</strong><button aria-label="Fechar janela" @click="windowName = null; article = null">×</button></div>
        <template v-if="article"><button class="desktop-back" @click="article = null">← Voltar</button><h4>{{ article.title }}</h4><p>{{ article.body }}</p></template>
        <template v-else-if="windowName === 'arquivos'"><div class="desktop-tabs"><button :aria-current="folder === 'manuais' ? 'page' : undefined" @click="folder = 'manuais'">Manuais</button><button :aria-current="folder === 'registros' ? 'page' : undefined" @click="folder = 'registros'">Registros</button></div><button v-for="file in files" :key="file.title" class="desktop-file" @click="article = file">▤ {{ file.title }}</button></template>
        <template v-else>
          <label class="desktop-search">Buscar nos arquivos e registros<input v-model="query" type="search" placeholder="Ex.: RAM, SATA, sem energia" /></label>
          <div class="web-search"><p>A pesquisa na internet abre o DuckDuckGo em outra aba e envia o termo digitado somente quando você clicar.</p><button :disabled="!query.trim()" @click="openWebSearch">Pesquisar na internet ↗</button></div>
          <p v-if="!results.length">Nenhum arquivo encontrado. Tente outro termo.</p>
          <button v-for="file in results" :key="file.title" class="desktop-file" @click="article = file">{{ file.category === 'manual' ? 'Manual' : 'Registro' }} · {{ file.title }}</button>
        </template>
      </section>
      <div class="desktop-taskbar"><span>ESCOLA · ARQUIVO LOCAL</span><span>OFFLINE</span></div>
    </div>
  </div>
</template>
