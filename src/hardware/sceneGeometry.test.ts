import { describe, expect, it } from 'vitest'
import { cableInfo, createHardwareCase, type CableId } from './hardware'
import { cablePoint } from './cableGeometry'
import { slotDropDistance, slotGeometry } from './sceneGeometry'
import { cableLayout } from './cableRoutes'

describe('geometria dos encaixes e conectores', () => {
  it('mantém o centro de cada encaixe sobre o desenho correspondente', () => {
    expect(slotGeometry.cpu).toMatchObject({ target: { x: 435, y: 230 }, sprite: { x: 435, y: 230 } })
    expect(slotGeometry.cooler).toMatchObject({ target: { x: 435, y: 230 }, sprite: { x: 435, y: 230 } })
    expect(slotGeometry.dimm_a2.target).toEqual({ x: 573.5, y: 243.5 })
    expect(slotGeometry.dimm_b2.target).toEqual({ x: 621.5, y: 243.5 })
    expect(slotGeometry.pcie_x16).toMatchObject({ target: { x: 469, y: 393 }, sprite: { x: 469, y: 359 } })
    expect(slotGeometry.m2).toMatchObject({ target: { x: 558, y: 466 }, sprite: { x: 558, y: 438 } })
    expect(slotGeometry.sata_bay.target).toEqual({ x: 968.5, y: 449 })
    expect(slotGeometry.front_button.target).toEqual({ x: 831.5, y: 641 })
  })

  it('leva as duas entradas do SSD junto com a baia', () => {
    const state = createHardwareCase('video')
    expect(cablePoint('disk_data', state.objects)).toEqual({ x: 903, y: 426 })
    expect(cablePoint('disk_power', state.objects)).toEqual({ x: 903, y: 466 })
    state.objects.ssd = { x: 970, y: 555 }
    expect(cablePoint('disk_data', state.objects)).toEqual({ x: 908, y: 531 })
    expect(cablePoint('disk_power', state.objects)).toEqual({ x: 908, y: 571 })
  })

  it('coloca AC, ventoinha e vídeo sobre os equipamentos desenhados', () => {
    const { objects } = createHardwareCase('video')
    expect(cablePoint('psu_ac', objects)).toEqual({ x: 104.5, y: 301 })
    expect(cablePoint('cooler_fan', objects)).toEqual({ x: 467, y: 254 })
    expect(cablePoint('monitor_hdmi', objects)).toEqual({ x: 867, y: 191 })
    expect(cablePoint('monitor_vga', objects)).toEqual({ x: 867, y: 229 })
  })

  it('aceita soltura da GPU sobre o slot ou com os contatos alinhados', () => {
    expect(slotDropDistance('pcie_x16', { x: 469, y: 393 }, { x: 469, y: 393 })).toBe(0)
    expect(slotDropDistance('pcie_x16', { x: 469, y: 359 }, { x: 469, y: 393 })).toBe(0)
  })

  it('mantém as 18 pontas ligadas nos equipamentos móveis', () => {
    const state = createHardwareCase('video')
    for (const cable of Object.keys(cableInfo) as CableId[]) state.connections[cable] = [...cableInfo[cable].ends]
    state.objects = { motherboard: { x: 630, y: 325 }, psu: { x: 115, y: 395 }, ssd: { x: 970, y: 555 }, monitor: { x: 965, y: 310 } }
    const ends = (Object.keys(cableInfo) as CableId[]).flatMap(cable => cableLayout(state, cable).ends)
    expect(ends).toHaveLength(18)
    for (const end of ends) expect(end.point).toEqual(cablePoint(end.connector, state.objects))
  })

  it('deixa pontas desligadas do SSD na mesa quando a baia se move ou o SSD sai', () => {
    const state = createHardwareCase('video')
    state.connections.sata_data = ['mb_sata1']
    state.connections.sata_power = ['psu_sata']
    state.cableEnds.sata_data.disk_data = { x: 850, y: 600 }
    state.cableEnds.sata_power.disk_power = { x: 900, y: 610 }
    state.parts.sata_bay = null
    state.objects.ssd = { x: 970, y: 555 }
    expect(cableLayout(state, 'sata_data').ends[1].point).toEqual({ x: 850, y: 581 })
    expect(cableLayout(state, 'sata_power').ends[1].point).toEqual({ x: 900, y: 610 })
  })

  it('mantém o cabo frontal e suas pontas fora do botão nos dois apoios da placa', () => {
    const state = createHardwareCase('video')
    const button = { left: 787, top: 604, right: 876, bottom: 678 }
    const overlaps = (x: number, y: number) => x >= button.left && x <= button.right && y >= button.top && y <= button.bottom
    expect(cablePoint('case_button', state.objects)).toEqual({ x: 750, y: 649 })
    for (const motherboard of [{ x: 520, y: 325 }, { x: 630, y: 325 }]) {
      state.objects.motherboard = motherboard
      for (const connected of [[], ['case_button'], ['mb_pwr_sw'], ['case_button', 'mb_pwr_sw']]) {
        state.connections.front_panel = connected
        const route = cableLayout(state, 'front_panel')
        expect(route.ends.every(end => !overlaps(end.point.x, end.point.y))).toBe(true)
        if (connected.length === 0) continue
        const vertices = [...route.path.matchAll(/[ML] (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map(match => ({ x: Number(match[1]), y: Number(match[2]) }))
        for (let i = 1; i < vertices.length; i++) for (let step = 0; step <= 20; step++) {
          const t = step / 20
          expect(overlaps(vertices[i - 1].x + (vertices[i].x - vertices[i - 1].x) * t, vertices[i - 1].y + (vertices[i].y - vertices[i - 1].y) * t)).toBe(false)
        }
      }
    }
  })
})
