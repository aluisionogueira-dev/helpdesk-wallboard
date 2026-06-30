# Painel Wallboard — Helpdesk / Atividades T.I.

Painel para TV (modo kiosk) que alterna automaticamente entre:
- **Helpdesk T.I.** (lista ClickUp `901318874855`) — fila de chamados do dia a dia
- **Atividades T.I.** (lista ClickUp `901002094100`) — prioridades, atrasos e tarefas do dia

Agora conectado a **dados reais do ClickUp** via duas funções serverless da Vercel.
Atualiza automaticamente a cada 45 segundos.

## Estrutura

```
.
├── api/
│   ├── helpdesk-data.js      ← busca tasks da lista Helpdesk no ClickUp
│   └── atividades-data.js   ← busca e filtra tasks da lista Atividades no ClickUp
├── public/
│   └── index.html            ← painel completo (HTML/CSS/JS)
├── vercel.json                ← config de rotas (estático + API)
└── README.md
```

## Configurar o token do ClickUp (passo obrigatório)

O painel não funciona sem isso — as duas funções em `api/` precisam de um
token válido para consultar a API do ClickUp.

### 1. Gerar o token

1. No ClickUp, vá em **Configurações (seu avatar) → Apps**.
2. Em "API Token", copie o token pessoal (começa com `pk_`).

### 2. Cadastrar como variável de ambiente na Vercel

1. No painel da Vercel, abra o projeto → **Settings → Environment Variables**.
2. Adicione:

| Nome | Valor |
|---|---|
| `CLICKUP_API_TOKEN` | seu token `pk_...` |
| `CLICKUP_LIST_HELPDESK` | `901318874855` |
| `CLICKUP_LIST_ATIVIDADES` | `901002094100` |

3. Marque para se aplicar em **Production**, **Preview** e **Development**.
4. Clique em **Save**.
5. Vá em **Deployments**, clique nos três pontinhos do último deploy e
   escolha **Redeploy** (variáveis de ambiente só entram em vigor em um novo deploy).

**Nunca coloque o token diretamente no código ou no `index.html`.** Ele só
deve existir como variável de ambiente, lida pelas funções em `api/`, que
rodam no servidor da Vercel — nunca no navegador da TV.

## Subir no GitHub

```bash
cd wallboard-deploy
git init
git add .
git commit -m "Painel wallboard com integração real ao ClickUp"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/NOME_DO_REPO.git
git push -u origin main
```

## Deploy na Vercel

1. Acesse [vercel.com/new](https://vercel.com/new) e importe o repositório.
2. A Vercel detecta `vercel.json` automaticamente.
3. **Antes do primeiro deploy**, configure as variáveis de ambiente (seção acima)
   — ou configure depois e faça um Redeploy.
4. Clique em Deploy.

## Como os dados são buscados

- `api/helpdesk-data.js` busca todas as tasks abertas da lista Helpdesk,
  calcula quantos dias cada ticket está aberto (`date_created`), agrupa por
  status e por responsável, e devolve tudo já processado.
- `api/atividades-data.js` busca todas as tasks abertas da lista Atividades
  e filtra apenas as relevantes: prioridade alta/urgente, tag `pra hoje`,
  ou vencidas (due date no passado). Ordena por mais atrasada primeiro.
- O `index.html` chama os dois endpoints a cada 45 segundos via `fetch`,
  reconstrói as tabelas, KPIs e paginação automaticamente.

## Ajustando os limites de "atrasado" / "crítico"

Em `api/helpdesk-data.js`, função `agingClass`:
```js
if (days >= 14) return 'crit';   // vermelho
if (days >= 7) return 'warn';    // âmbar
```

Em `api/atividades-data.js`, função `agingClassFromDue`:
```js
if (diffDays >= 7) return 'crit';
if (diffDays > 0) return 'warn';
```

Ajuste esses números conforme o SLA real da operação.

## Ajustando tempos de tela

No `<script>` final de `public/index.html`:
- `setInterval(loadHelpdesk, 45000)` / `setInterval(loadAtividades, 45000)` —
  frequência de busca de dados novos (45s).
- Troca entre tela Helpdesk/Atividades: `}, 60000);` dentro do bloco
  `(function () { ... })()` no final do script (atualmente 1 minuto).
- Paginação interna: `8000` (Helpdesk, 8s) e `6000` (Atividades, 6s),
  passados como `intervalMs` para `buildPagination(...)`.

## Colocando na TV

Abra a URL da Vercel no navegador da TV em modo tela cheia (F11 no Chrome,
ou modo kiosk: `chrome --kiosk URL`). A página recarrega sozinha a cada
30 minutos para garantir que está sempre na versão mais recente publicada.
