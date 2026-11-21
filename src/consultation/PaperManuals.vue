<script setup lang="ts">
import { computed, ref } from 'vue'
import { articles } from './documents'
const pages = articles.filter(item => item.category === 'manual')
const page = ref(0)
const current = computed(() => pages[page.value])
</script>

<template>
  <div class="paper-stack">
    <nav class="paper-navigation" aria-label="Páginas dos manuais"><button :disabled="page === 0" @click="page--">← Anterior</button><span>Folha {{ page + 1 }} de {{ pages.length }}</span><button :disabled="page === pages.length - 1" @click="page++">Próxima →</button></nav>
    <article class="paper-sheet"><header><span>ESCOLA · LABORATÓRIO DE TI</span><span>MANUAL {{ String(page + 1).padStart(2, '0') }}</span></header><h4>{{ current.title }}</h4><p>{{ current.body }}</p><div class="paper-diagram"><svg viewBox="0 0 480 135" role="img" :aria-label="`Diagrama técnico: ${current.title}`"><path d="M35 68h405" stroke="currentColor" stroke-width="3"/><g v-for="(label, index) in (page === 0 ? ['AC', 'FONTE', 'ATX', 'EPS'] : page === 1 ? ['CPU', 'DIMM', 'PCIe', 'SATA'] : page === 2 ? ['BOTÃO', 'PWR_SW', 'POST', 'TELA'] : ['FIXAR', 'APOIO', 'CABOS', 'TESTE'])" :key="label"><rect :x="24 + index * 112" y="43" width="92" height="50" fill="#faf6e9" stroke="currentColor" stroke-width="2"/><text :x="70 + index * 112" y="74" text-anchor="middle" fill="currentColor" font-size="13" font-weight="700">{{ label }}</text></g></svg><small>Figura {{ page + 1 }} · Sequência de inspeção esquemática</small></div><footer>Oficina de TI · Material fictício para aprendizagem <span>{{ String(page + 1).padStart(2, '0') }}</span></footer></article>
  </div>
</template>
