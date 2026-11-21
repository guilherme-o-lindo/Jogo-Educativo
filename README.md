# Oficina de TI

Jogo educativo no navegador com oito chamados de uma escola: seis de hardware, um de sistema operacional e um de banco de dados. Não há limite de tempo. O progresso fica salvo somente neste navegador.

## Executar

Requer Node.js 20 ou superior.

```bash
npm install
npm run dev
```

Para verificar e gerar o site estático:

```bash
npm test
npm run build
```

O site pronto fica em `dist/`.

## Organização

```text
src/
├── main.ts                 entrada e estilos
├── app/                    interface da sala e estilos gerais
├── game/                   chamados, estado da partida e salvamento
├── hardware/               bancada, peças, cabos, casos e geometria
└── consultation/           manuais e computador de consulta
```

A direção principal das dependências é `app → game → hardware`. A interface também usa a bancada e os componentes de `consultation`, que não dependem do estado da partida. As ações da bancada passam por `applyHardwareToGame`, que atualiza o caso, o chamado ativo e o progresso. `saveSession` grava a partida no armazenamento local após as mudanças; `loadSession` valida e migra salvamentos antigos ao abrir o jogo. Os testes ficam junto dos módulos correspondentes e rodam com `npm test`.

## Controles

- Segure **WASD** ou as **setas** para caminhar; clique ou toque numa estação para traçar caminho.
- Use **E**, **espaço** ou **Interagir** ao chegar perto.
- Use **Esc** para fechar painéis. No celular, mantenha pressionados os botões de direção.
- A mesa central tem folhas de manuais paginadas e um computador com desktop simulado. Abra Arquivos, Registros ou Pesquisa local. A ação **Pesquisar na internet** abre o DuckDuckGo em outra aba, com região Brasil e busca segura, e envia apenas o termo digitado após o clique. A consulta não é guardada no jogo. O armário oferece reposições ilimitadas.
- Na bancada, os nove cabos ficam visíveis: ligados entre as portas, com uma ponta solta ou enrolados na mesa. HDMI da GPU e VGA da placa ficam na borda externa do gabinete; o botão frontal fica no gabinete e liga aos pinos PWR_SW. Clique no cabo e depois nas portas destacadas, ou arraste a ponta até a porta. Selecione uma ligação para **soltar uma ponta** ou o cabo inteiro. Para cancelar a seleção, clique novamente no item, clique em uma área vazia do desenho, use **Limpar seleção** ou pressione `Esc`. Para peças, selecione e clique no encaixe destacado ou arraste até ele; selecione um encaixe ocupado e use **Remover peça**. Arraste a fonte, o SSD e o monitor para mover; com o objeto em foco, use as setas do teclado (Shift para ajuste fino). A placa-mãe permanece fixa no gabinete. A tensão prevista aparece durante o arraste. Um cabo além do alcance rompe apenas na simulação. No celular, os botões **Fonte**, **Placa-mãe** e **Monitor e SSD** levam diretamente a cada região.
- Acione diretamente na máquina as chaves do estabilizador e da fonte, o seletor de tensão quando existir e o botão frontal. O botão funciona com a ponta `mb_pwr_sw` do cabo conectada aos pinos PWR_SW da placa. Para testar com a chave de fenda, desligue a fonte, desconecte a alimentação externa e solte essa ponta; a outra pode continuar no botão. Com os pinos livres, encoste a chave no mesmo par PWR_SW. Reconecte a ponta para voltar a usar o botão. A bancada indica se os pinos estão ocupados ou livres e explica ações recusadas. A placa-mãe permanece montada no gabinete.
- Para confirmar cada caso de hardware, faça uma nova partida pelo botão. O teste com a chave de fenda nos pinos PWR_SW serve para isolar falha do botão. **Reiniciar este caso** preserva os demais chamados.

Fontes automáticas aceitam a alimentação prevista pelo caso. Na fonte manual, confira o seletor antes da partida: uma tentativa com tensão errada inutiliza somente a fonte **simulada**. Troque-a por outra do armário. Cabos esticados além do alcance também se rompem apenas dentro do jogo. Na manutenção real, consulte o manual do equipamento.

## Publicação

O Vite usa caminhos relativos e gera conteúdo estático em `dist/`. A publicação não é automática.
