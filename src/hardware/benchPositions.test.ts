import { describe, expect, it } from 'vitest'
import { cableInfo, createHardwareCase } from './hardware'
import { cablePoint } from './cableGeometry'
import { positionCableStatus, resolveObjectPosition } from './benchPositions'

describe('posições da bancada', () => {
  it('antecipa a tensão dos cabos sem alterar o estado salvo', () => {
    const state = createHardwareCase('video')
    const snapshot = JSON.stringify(state)
    const result = positionCableStatus(state, 'psu', { x: 1000, y: 325 })
    expect(result.some(item => item.cable === 'eps8' && item.status === 'broken')).toBe(true)
    expect(JSON.stringify(state)).toBe(snapshot)
    expect(cableInfo.eps8.name).toBeTruthy()
  })

  it('solta fonte e monitor em posições livres e desvia de equipamentos', () => {
    const objects = createHardwareCase('video').objects
    expect(resolveObjectPosition('psu', { x: 120, y: 360 }, objects)).toEqual({ x: 120, y: 360 })
    expect(resolveObjectPosition('monitor', { x: 940, y: 260 }, objects)).toEqual({ x: 940, y: 260 })
    const nearSsd = resolveObjectPosition('monitor', { x: 965, y: 400 }, objects)
    expect(nearSsd).not.toEqual({ x: 965, y: 400 })
    expect(nearSsd.y).toBeLessThanOrEqual(288)
  })

  it('solta o SSD fora dos presets e leva DATA e POWER junto', () => {
    const objects = createHardwareCase('video').objects
    const free = resolveObjectPosition('ssd', { x: 900, y: 530 }, objects)
    expect(free).toEqual({ x: 900, y: 530 })
    objects.ssd = free
    expect(cablePoint('disk_data', objects)).toEqual({ x: 838, y: 506 })
    expect(cablePoint('disk_power', objects)).toEqual({ x: 838, y: 546 })
    const blocked = resolveObjectPosition('ssd', { x: 600, y: 350 }, objects)
    expect(blocked.x - 80 >= 818 || blocked.x + 87 <= 217 || blocked.y - 59 >= 583).toBe(true)
  })

  it('mantém o monitor inteiro na cena e fora da placa deslocada', () => {
    const objects = createHardwareCase('video').objects
    const position = resolveObjectPosition('monitor', { x: 1400, y: 700 }, objects)
    expect(position.x).toBeGreaterThanOrEqual(98)
    expect(position.x).toBeLessThanOrEqual(1301)
    expect(position.y).toBeGreaterThanOrEqual(95)
    expect(position.y).toBeLessThanOrEqual(605)
    expect(position.x + 99 <= 217 || position.x - 98 >= 818 || position.y + 95 <= 67 || position.y - 95 >= 583).toBe(true)
  })

  it('abre área livre para mover a fonte à direita da placa', () => {
    const objects = createHardwareCase('video').objects
    expect(resolveObjectPosition('psu', { x: 1210, y: 385 }, objects)).toEqual({ x: 1210, y: 385 })
  })
})
