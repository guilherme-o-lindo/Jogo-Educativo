import { describe, expect, it } from 'vitest'
import { createHardwareCase } from './hardware'
import { cableLayout } from './cableRoutes'
import { cablePoint } from './cableGeometry'

describe('desenho permanente dos cabos', () => {
  it('dá percursos próprios aos cabos ligados e indica as duas pontas', () => {
    const state = createHardwareCase('video')
    const atx = cableLayout(state, 'atx24')
    const eps = cableLayout(state, 'eps8')
    expect(atx.status).toBe('connected')
    expect(atx.path).not.toBe(eps.path)
    expect(atx.ends.every(end => end.connected)).toBe(true)
  })

  it('põe um cabo desligado enrolado na mesa e conserva pontas antigas', () => {
    const state = createHardwareCase('power')
    state.connections.vga = []
    const coiled = cableLayout(state, 'vga')
    expect(coiled.status).toBe('coiled')
    expect(coiled.path).toContain('C')
    state.cableEnds.vga.mb_vga = { x: 300, y: 620 }
    const legacy = cableLayout(state, 'vga')
    expect(legacy.ends[0].point).toEqual({ x: 300, y: 620 })
    expect(legacy.path).not.toBe(coiled.path)
  })

  it('mostra a ponta livre do cabo parcialmente conectado', () => {
    const state = createHardwareCase('power')
    state.connections.atx24 = ['psu_atx24']
    const layout = cableLayout(state, 'atx24')
    expect(layout.status).toBe('partial')
    expect(layout.ends.map(end => end.connected)).toEqual([true, false])
    expect(layout.ends[1].point.y).toBeGreaterThan(580)
  })

  it('mantém as portas de vídeo na placa fixa e leva a entrada AC com a fonte', () => {
    const state = createHardwareCase('video')
    expect(cablePoint('mb_vga', state.objects)).toEqual({ x: 240, y: 313 })
    expect(cablePoint('gpu_hdmi', state.objects)).toEqual({ x: 240, y: 392 })
    state.objects.psu = { x: 1210, y: 385 }
    expect(cablePoint('psu_ac', state.objects)).toEqual({ x: 1199.5, y: 441 })
  })

  it('limita a curvatura dos fios ligados sem usar faixas distantes', () => {
    const state = createHardwareCase('video')
    for (const cable of ['atx24', 'hdmi', 'vga'] as const) {
      if (cable === 'hdmi') state.connections.hdmi = ['gpu_hdmi', 'monitor_hdmi']
      if (cable === 'vga') state.connections.vga = ['mb_vga', 'monitor_vga']
      const route = cableLayout(state, cable)
      const numbers = route.path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
      expect(route.path).toContain('C')
      const ys = numbers.filter((_, index) => index % 2 === 1)
      const endYs = route.ends.map(end => end.point.y)
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(Math.min(...endYs) - 24)
      expect(Math.max(...ys)).toBeLessThanOrEqual(Math.max(...endYs) + 24)
    }
  })
  it('desvia fios soltos que cruzariam o botão frontal', () => {
    const state = createHardwareCase('power')
    state.cableEnds.vga.mb_vga = { x: 760, y: 640 }
    state.cableEnds.vga.monitor_vga = { x: 930, y: 640 }
    const route = cableLayout(state, 'vga')
    expect(route.path).toContain('L 760 570 L 930 570')
    expect(route.ends.map(end => end.point)).toEqual([{ x: 760, y: 640 }, { x: 930, y: 640 }])
  })
  it('mantém pontas soltas fora das chaves físicas', () => {
    const state = createHardwareCase('power')
    state.connections.ac = []
    state.cableEnds.ac.wall_ac = { x: 165, y: 585 }
    const end = cableLayout(state, 'ac').ends[0].point
    expect(Math.abs(end.x - 165) >= 72 || Math.abs(end.y - 585) >= 72).toBe(true)
    state.cableEnds.ac.wall_ac = { x: 65, y: 168 }
    const nearPsu = cableLayout(state, 'ac').ends[0].point
    expect(Math.abs(nearPsu.x - 65) >= 72 || Math.abs(nearPsu.y - 168) >= 72).toBe(true)
    expect(Math.abs(nearPsu.x - 170) >= 72 || Math.abs(nearPsu.y - 168) >= 72).toBe(true)
  })
})
