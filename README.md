# Painel Wallboard — Helpdesk / Atividades T.I.

Painel para TV (modo kiosk) que alterna automaticamente entre:
- **Helpdesk T.I.** (lista ClickUp `901318874855`) — fila de chamados do dia a dia
- **Atividades T.I.** (lista ClickUp `901002094100`) — prioridades, atrasos e tarefas do dia

Atualmente roda com **dados de exemplo fixos no HTML**. A próxima etapa é
conectar a um endpoint serverless na Vercel que busca os dados reais no
ClickUp (ver seção "Próximos passos").

## Estrutura

```
.
├── public/
│   └── index.html      ← o painel completo (HTML/CSS/JS, sem dependências externas)
├── vercel.json          ← config mínima de deploy
└── README.md
```

## Subir no GitHub

```bash
cd wallboard-deploy
git init
git add .
git commit -m "Painel wallboard inicial - dados de exemplo"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/NOME_DO_REPO.git
git push -u origin main
```

## Deploy na Vercel

1. Acesse [vercel.com/new](https://vercel.com/new) e importe o repositório do GitHub.
2. A Vercel detecta `vercel.json` automaticamente — **não precisa configurar build
   command nem output directory na UI**, já está no arquivo.
3. Clique em Deploy. Em ~30s você tem uma URL tipo `seu-projeto.vercel.app`.

## Editando o conteúdo

Todo o painel está em `public/index.html`. Pontos fáceis de editar:

- **Tickets de exemplo**: dentro de `<tbody id="queue-page-1">`, `queue-page-2`,
  `atv-page-1` a `atv-page-4` — cada `<tr>` é uma linha de chamado/atividade.
- **KPIs do topo**: blocos `.kpi-card`, valores nos `.kpi-valor`.
- **Tempo de cada tela**: no `<script>` final,
  `setInterval(..., 15000)` controla a troca entre Helpdesk/Atividades (15s),
  e os dois `setupPagination(...)` controlam a paginação interna de cada fila
  (8s e 6s respectivamente).
- **Cores/tema**: tudo nas CSS variables no topo do `<style>` (`--accent`,
  `--bg`, etc.) — mesmo tema do projeto de monitoramento fluvial.

## Colocando na TV

Abra a URL da Vercel no navegador da TV (ou num mini-PC/Chromecast conectado)
em modo tela cheia (F11 no Chrome, ou modo kiosk: `chrome --kiosk URL`).

## Próximos passos (dados reais via ClickUp)

Hoje os dados são fixos no HTML. Para tempo real:

1. Criar `api/helpdesk-data.js` e `api/atividades-data.js` como funções
   serverless da Vercel, usando a API do ClickUp com o token guardado em
   variável de ambiente (nunca no código).
2. O `index.html` passa a fazer `fetch('/api/helpdesk-data')` e
   `fetch('/api/atividades-data')` a cada 30-60s, substituindo as linhas
   da tabela dinamicamente via JS.
3. Variáveis de ambiente na Vercel (Project Settings → Environment Variables):
   - `CLICKUP_API_TOKEN`
   - `CLICKUP_LIST_HELPDESK=901318874855`
   - `CLICKUP_LIST_ATIVIDADES=901002094100`

Aviso: o token da API do ClickUp **nunca** deve aparecer no `index.html` nem
em qualquer arquivo dentro de `public/` — ele só pode existir dentro das
funções serverless em `api/`, que rodam no servidor da Vercel.
