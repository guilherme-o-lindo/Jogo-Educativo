# Oficina de TI

Jogo educativo em navegador para estudantes de técnico em informática. Em um plantão de cinco minutos, o jogador recebe três chamados de uma escola e resolve problemas de hardware, sistema operacional e banco de dados.

## Executar

Requer Node.js 20 ou superior.

```bash
npm install
npm run dev
```

Abra o endereço local mostrado pelo Vite. Para verificar e gerar a versão estática:

```bash
npm test
npm run build
```

O site pronto fica em `dist/`.

## Controles

- **WASD ou setas:** mover o técnico.
- **E ou espaço:** interagir quando estiver ao lado de uma bancada.
- **Esc:** fechar a tarefa aberta.
- Em telas pequenas, use os botões de direção e **Interagir**.

Pegue um chamado no balcão, resolva a tarefa na bancada indicada e leve a solução à entrega. Os próximos chamados chegam depois de 45 e 90 segundos. Respostas incorretas oferecem uma dica e permitem nova tentativa.

## Publicar no GitHub Pages

O Vite usa caminhos relativos, então `dist/` pode ser servido em um repositório de projeto do GitHub Pages. Depois de criar o repositório, configure um fluxo de publicação que execute `npm ci`, `npm run build` e publique o conteúdo de `dist/`. Nenhuma conta ou repositório de destino está configurado neste projeto.

Os desenhos vetoriais em pixel art de `public/assets/` foram feitos para este jogo.
