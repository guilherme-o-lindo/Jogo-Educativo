import type { CableId, HardwareState } from './hardware'

export function wrongVoltage(psu: HardwareState['psu']): boolean {
  return psu.kind === 'manual' && psu.voltage !== psu.supply
}

export function powerAvailable(state: HardwareState, cableReady: (id: CableId) => boolean): boolean {
  return state.stabilizerOn && state.psuOn && !state.psu.failed && cableReady('ac') && cableReady('atx24') && cableReady('eps8')
}
