export interface Article { title: string; category: 'manual' | 'registro'; body: string; tags: string[] }

export const articles: Article[] = [
  { title: 'Alimentação e segurança', category: 'manual', body: 'Tomada → cabo de força → estabilizador fictício → entrada AC → chave I/O → fonte → ATX 24 pinos e EPS. Para alterar conexões internas, desligue a fonte e retire o cabo externo. Fonte manual: confira a tensão da tomada antes de ligar. Nesta simulação, seleção errada inutiliza somente a fonte virtual; retire uma reposição no armário.', tags: ['energia', 'fonte', 'tensão', 'eps'] },
  { title: 'Slots da placa Escola-mATX', category: 'manual', body: 'CPU no socket, cooler sobre a CPU, RAM nos DIMM, placa de vídeo no PCIe x16 e SSD M.2 no slot M.2. O SSD SATA precisa de energia e dados. A CPU deste modelo não oferece vídeo integrado; conecte o monitor à GPU.', tags: ['cpu', 'ram', 'vídeo', 'ssd', 'sata'] },
  { title: 'Painel frontal e partida', category: 'manual', body: 'O cabo do botão liga o botão frontal aos pinos PWR_SW em F_PANEL. Para isolar falha do botão, desligue a fonte, desconecte a alimentação externa e solte a ponta do cabo nos pinos da placa. Com os pinos livres, encoste a chave de fenda neles; com o cabo conectado, use o botão. Confirme o reparo com nova partida pelo botão.', tags: ['botão', 'pwr_sw', 'partida'] },
  { title: 'Bancada e conexões', category: 'manual', body: 'Na bancada, os nove cabos permanecem visíveis. As portas HDMI da GPU e VGA da placa ficam na borda externa do gabinete; o botão frontal liga aos pinos PWR_SW da placa. Clique num cabo e nas portas destacadas ou arraste cada ponta até sua porta. Ao selecionar uma ligação, solte uma ponta ou o cabo inteiro. Clique novamente no item, em uma área vazia do desenho, em Limpar seleção ou pressione Esc para cancelar a seleção. Peças podem ser instaladas por clique ou arraste nos encaixes destacados. Acione as chaves do estabilizador e da fonte e o seletor de tensão na própria máquina. A placa-mãe permanece montada no gabinete. Arraste fonte, SSD e monitor e confira a tensão prevista durante o movimento; com o objeto em foco, use as setas para movê-lo pelo teclado. Para testar PWR_SW com a chave, desligue a fonte, desconecte a alimentação e solte a ponta do cabo nos pinos da placa; depois arraste a chave até esse mesmo par ou selecione a ferramenta e ative o conector pelo teclado. Acima do comprimento, o cabo rompe nesta simulação. A partida mostra as pistas para localizar falhas de alimentação, RAM, vídeo ou armazenamento.', tags: ['bancada', 'cabo', 'partida'] },
  { title: 'Registro: mudança de sala', category: 'registro', body: 'Depois de mover a estação, não houve resposta ao botão. Conferir o caminho de energia e comparar a partida pelo painel frontal e pelos pinos.', tags: ['sem energia', 'botão'] },
  { title: 'Registro: tela sem sinal', category: 'registro', body: 'Ventoinhas giram, mas não há imagem. Observar o indicador de POST antes de alterar os cabos de vídeo.', tags: ['vídeo', 'ram'] },
  { title: 'Registro: transporte', category: 'registro', body: 'Após transporte, a máquina apresenta mais de uma falha. Um teste positivo da fonte não conclui o diagnóstico; avance pelos indicadores de POST.', tags: ['transporte', 'eps', 'ram', 'sata'] },
]

export function searchArticles(query: string): Article[] {
  const term = query.trim().toLocaleLowerCase('pt-BR')
  return articles.filter(article => !term || `${article.title} ${article.body} ${article.tags.join(' ')}`.toLocaleLowerCase('pt-BR').includes(term))
}

export function externalSearchUrl(query: string): string {
  const url = new URL('https://duckduckgo.com/')
  url.searchParams.set('q', query.trim())
  url.searchParams.set('kl', 'br-pt')
  url.searchParams.set('kp', '1')
  return url.toString()
}
