# Direção visual

A sala de TI é um tabuleiro 2D visto de cima. Sprites vetoriais em pixel art, grade de piso e contornos nítidos tornam as bancadas fáceis de reconhecer. A paleta usa azul petróleo e verde escuro no ambiente, âmbar para ações e chamados, e verde claro para sucesso.

O mapa ocupa a maior área da tela. Progresso e fila ficam acima e ao lado dele; em telas pequenas, o painel vai para baixo do mapa e surgem controles de direção. A bancada de hardware abre em tela cheia com uma placa ATX ilustrada na linguagem de modelos dos anos 2010: PCB escuro, VRM, capacitores, dissipador, travas dos dois DIMMs funcionais, PCIe, M.2 e conectores de borda identificados. VGA da placa e HDMI da GPU aparecem na borda externa do gabinete. O botão frontal fica separado do conector do cabo, que percorre a esquerda do suporte até os pinos PWR_SW. Os nove cabos permanecem visíveis, com pontas livres ou enrolados sobre a mesa. A inspeção abre uma ficha escura próxima ao item selecionado, com ações e fechamento acessíveis por teclado; objetivo e resultado ficam numa faixa discreta abaixo da máquina. A seleção destaca os destinos compatíveis em verde; o âmbar marca foco e ação temporária. Há atalhos para as regiões no celular; chaves, seletor e botão frontal são acionados na cena; a chave de fenda fecha os pinos PWR_SW. A lateral reúne apenas a bandeja e a navegação. Equipamentos usam posições visíveis e prévia de tensão durante o movimento. O texto usa Chakra Petch servido localmente pelo pacote instalado.

O computador da mesa mantém a moldura arcade, com desktop escolar, barra inferior e janelas de arquivos, registros e pesquisa local. Um botão distinto informa quando a pesquisa vai para a internet. Os manuais são a única superfície com aparência de papel impresso: folhas claras, numeração, diagramas esquemáticos e paginação legível no celular.

Feedback de erro explica uma pista técnica e permite tentar outra ação. O teste da máquina mostra o sintoma produzido pelo estado atual de peças e cabos. Os desenhos são originais e não reproduzem personagens ou elementos de jogos conhecidos.

## Tokens e interação da fase 2

| Papel | Valor | Uso |
| --- | --- | --- |
| Fundo | `#0c1720` | moldura da sala e bancada |
| Superfície | `#193039` | painéis e gavetas |
| Placa | `#285145` | eletrônica e ações de manutenção |
| Âmbar | `#efc271` | foco, interação e avisos |
| Verde claro | `#9cdeb0` | sucesso |
| Texto | `#e9f3ef` | conteúdo principal |

A unidade de espaço é 4 px. Controles de toque têm pelo menos 44 px. Bordas retas e sombras deslocadas compõem o visual arcade. A bancada mantém a máquina central e a bandeja lateral. Press Start 2P, servida localmente, aparece só em títulos e indicadores; os textos técnicos usam Chakra Petch. O foco visível usa âmbar. Transições curtas respeitam `prefers-reduced-motion`.

As peças da bancada usam o mesmo sprite vetorial quando instaladas, sobre a mesa, na bandeja e durante o arraste. Socket e baia permanecem visíveis quando vazios. A peça inteira recebe o gesto; uma prévia única acompanha o ponteiro e o estado do jogo muda apenas ao soltar. A bandeja tem rolagem e reúne reposições e peças retiradas; peças deixadas na mesa conservam a posição. Fonte, monitor e SSD podem ser soltos em pontos livres sem sobrepor equipamentos; a placa-mãe permanece montada no gabinete. O SSD instalado se move com a baia e os conectores; a retirada usa o comando Remover peça. Os contornos de seleção da cena aparecem numa camada visual acima dos fios e das pontas, sem bloquear a interação. Os objetos em foco podem ser movidos pelas setas do teclado.

Os sprites têm proporções próprias e escala uniforme em todos os contextos. A RAM é desenhada horizontalmente e gira inteira ao entrar no slot DIMM; os trilhos têm largura compatível com a peça para ela ocupar quase toda a altura sem esticar círculos, letras e detalhes. A área de toque pode ser maior que o desenho, sem deformá-lo. A inspeção identifica a peça selecionada, seu estado e o encaixe quando instalada.
