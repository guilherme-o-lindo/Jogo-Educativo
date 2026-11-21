import type { CableId, HardwareCaseId, PartId, SlotId } from './hardware'

export const hardwareCases: Record<HardwareCaseId, { title: string; symptom: string; goal: string }> = {
  power: { title: 'Laboratório sem energia', symptom: 'O computador não dá sinal de vida após a mudança de sala.', goal: 'Restabeleça a alimentação e descubra por que o botão frontal não responde.' },
  video: { title: 'Tela apagada no laboratório', symptom: 'Ventoinhas giram, mas o monitor não mostra imagem.', goal: 'Use os indicadores da placa e o caminho do vídeo para encontrar os dois problemas.' },
  storage: { title: 'Disco ausente na secretaria', symptom: 'A máquina liga, mas não encontra o disco de dados.', goal: 'Confira cabos SATA, teste a unidade e substitua o componente defeituoso.' },
  psu: { title: 'Fonte sem saída', symptom: 'A máquina não dá sinal de vida, embora a tomada funcione.', goal: 'Teste a alimentação e substitua a fonte defeituosa.' },
  voltage: { title: 'Seletor da fonte manual', symptom: 'A fonte manual veio configurada para uma tensão diferente da tomada.', goal: 'Consulte o manual, ajuste a tensão e teste a partida com uma fonte funcional.' },
  combined: { title: 'Falhas após transporte', symptom: 'A máquina não inicia após o transporte entre salas.', goal: 'Investigue alimentação da CPU, memória e cabo de dados.' },
}

export const caseSetup: Record<HardwareCaseId, { missingCables?: CableId[]; part?: { slot: SlotId; part: PartId }; faultyPsu?: boolean; manualVoltage?: boolean; brokenCables?: CableId[] }> = {
  power: { missingCables: ['ac', 'atx24', 'eps8'], part: { slot: 'front_button', part: 'button_faulty' } },
  video: { missingCables: ['hdmi'], part: { slot: 'dimm_a2', part: 'ram_faulty' } },
  storage: { missingCables: ['sata_data', 'sata_power'], part: { slot: 'sata_bay', part: 'ssd_sata_faulty' } },
  psu: { faultyPsu: true },
  voltage: { manualVoltage: true },
  combined: { missingCables: ['eps8'], part: { slot: 'dimm_a2', part: 'ram_faulty' }, brokenCables: ['sata_data'] },
}
