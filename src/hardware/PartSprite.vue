<script setup lang="ts">
import { computed } from 'vue'
import type { PartId } from './hardware'

const props = withDefaults(defineProps<{ part: PartId; vertical?: boolean }>(), { vertical: false })
const ram = computed(() => props.part === 'ram_good' || props.part === 'ram_faulty')
const viewBox = computed(() => {
  if (ram.value) return props.vertical ? '0 0 28 190' : '0 0 190 28'
  if (props.part === 'gpu') return '0 0 295 70'
  if (props.part === 'ssd_m2') return '0 0 116 42'
  if (props.part === 'ssd_sata_good' || props.part === 'ssd_sata_faulty') return '0 0 167 116'
  return '0 0 100 100'
})
</script>

<template>
  <svg class="part-sprite" :viewBox="viewBox" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <g :transform="ram && vertical ? 'translate(0 190) rotate(-90)' : undefined">
    <g v-if="part === 'cpu_i5'">
      <rect x="8" y="8" width="84" height="84" rx="4" fill="#b6c9ae" stroke="#203c3c" stroke-width="5"/>
      <rect x="20" y="20" width="60" height="60" fill="#bfc8bd" stroke="#e2e6d8" stroke-width="3"/><path d="M27 28h46M27 72h46" stroke="#899f96" stroke-width="2"/>
      <path d="M4 22h13M4 40h13M4 58h13M4 76h13M83 22h13M83 40h13M83 58h13M83 76h13" stroke="#d6bb7c" stroke-width="4"/>
      <text x="50" y="55" text-anchor="middle">CPU</text>
    </g>
    <g v-else-if="part === 'cooler_stock'">
      <circle cx="50" cy="50" r="45" fill="#263b3c" stroke="#a5bdac" stroke-width="5"/>
      <rect x="4" y="4" width="92" height="92" rx="8" fill="none" stroke="#c3cbb7" stroke-width="3"/><circle cx="12" cy="12" r="3" fill="#d6d9c7"/><circle cx="88" cy="12" r="3" fill="#d6d9c7"/><circle cx="12" cy="88" r="3" fill="#d6d9c7"/><circle cx="88" cy="88" r="3" fill="#d6d9c7"/>
      <circle cx="50" cy="50" r="31" fill="#456861" stroke="#bbcfb7" stroke-width="3"/>
      <path d="M50 19v62M19 50h62M28 28l44 44M72 28L28 72" stroke="#81a598" stroke-width="6"/>
      <circle cx="50" cy="50" r="9" fill="#cfdbbf"/>
    </g>
    <g v-else-if="ram">
      <rect x="4" y="3" width="182" height="21" fill="#386c50" stroke="#a5c2a5" stroke-width="2"/>
      <rect v-for="i in 7" :key="i" :x="10 + (i - 1) * 25" y="7" width="17" height="12" fill="#173c39" stroke="#8fb29a" stroke-width="1"/>
      <path v-for="i in 14" :key="`pin-${i}`" :d="`M${9 + (i - 1) * 13} 24v4`" stroke="#d7bb7a" stroke-width="5"/>
      <path d="M91 24v4" stroke="#1a3a33" stroke-width="8"/>
      <text x="95" y="18" text-anchor="middle">RAM</text>
    </g>
    <g v-else-if="part === 'gpu'">
      <rect x="5" y="7" width="285" height="54" fill="#344f59" stroke="#9cb4b1" stroke-width="4"/>
      <rect x="7" y="8" width="282" height="52" fill="none" stroke="#5f7673" stroke-width="2"/><path d="M20 12h250M20 57h250" stroke="#9daf9e" stroke-width="2"/>
      <circle cx="94" cy="34" r="22" fill="#1c3338" stroke="#9db5ac" stroke-width="3"/>
      <path d="M94 14v40M74 34h40M80 20l28 28M108 20L80 48" stroke="#83a499" stroke-width="3"/>
      <rect x="139" y="17" width="40" height="34" fill="#263e45" stroke="#78998f" stroke-width="2"/>
      <circle cx="159" cy="34" r="11" fill="#273f43" stroke="#a8b7aa" stroke-width="2"/><path d="M152 27l14 14m0-14-14 14" stroke="#6f9186" stroke-width="2"/>
      <path d="M195 22h72m-72 11h72m-72 11h72" stroke="#6e8c89" stroke-width="5"/>
      <rect x="33" y="61" width="215" height="8" fill="#d0b574"/>
      <text x="12" y="16">GPU</text>
    </g>
    <g v-else-if="part === 'ssd_sata_good' || part === 'ssd_sata_faulty'">
      <rect x="5" y="8" width="157" height="99" rx="5" fill="#546567" stroke="#b5c6ae" stroke-width="4"/>
      <rect x="18" y="22" width="131" height="70" fill="#27414a"/><path d="M30 29h108M30 86h108" stroke="#65817b" stroke-width="2"/><rect x="57" y="42" width="66" height="31" fill="#405d5d" stroke="#809990" stroke-width="2"/>
      <rect x="8" y="29" width="20" height="12" rx="1" fill="#172e34" stroke="#d0bc8e" stroke-width="2"/>
      <rect x="8" y="69" width="20" height="12" rx="1" fill="#172e34" stroke="#d0bc8e" stroke-width="2"/>
      <text x="34" y="39">DATA</text><text x="34" y="79">POWER</text>
      <circle cx="14" cy="18" r="3" fill="#d4decf"/><circle cx="153" cy="97" r="3" fill="#d4decf"/>
        <path d="M27 104v8h32m24-8v8h32" stroke="#d0bc8e" stroke-width="4"/>
      <text x="83" y="62" text-anchor="middle">SSD</text>
    </g>
    <g v-else-if="part === 'ssd_m2'">
      <rect x="3" y="5" width="110" height="32" rx="3" fill="#386c50" stroke="#a5c2a5" stroke-width="2"/>
      <path d="M4 8h8v10H4m0 8h8v8H4" fill="#d7bb7a"/>
      <rect x="12" y="11" width="23" height="20" fill="#173c39" stroke="#8fb29a" stroke-width="1"/>
      <rect x="42" y="11" width="23" height="20" fill="#173c39" stroke="#8fb29a" stroke-width="1"/>
      <circle cx="102" cy="21" r="4" fill="#263e45" stroke="#c3d0b4" stroke-width="1"/>
        <path d="M7 35v5h25" stroke="#d7bb7a" stroke-width="3"/>
      <text x="82" y="26" text-anchor="middle">M.2</text>
    </g>
    <g v-else>
      <rect x="8" y="8" width="84" height="84" fill="#3f5557" stroke="#9bb2a3" stroke-width="5"/>
      <rect x="16" y="16" width="68" height="68" fill="#233a3e" stroke="#607d73" stroke-width="2"/>
      <circle cx="50" cy="50" r="30" fill="#e9c47f" stroke="#18323b" stroke-width="6"/>
      <path d="M50 27v27m-13-16a18 18 0 1 0 26 0" fill="none" stroke="#34514a" stroke-width="5"/>
    </g>
    </g>
  </svg>
</template>
