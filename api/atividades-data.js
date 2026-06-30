// api/atividades-data.js
// Endpoint serverless da Vercel: busca tasks abertas da lista Atividades no ClickUp,
// filtra pelas relevantes (prioridade alta/urgente, tag "pra hoje", ou atrasadas)
// e devolve um JSON já processado para o painel consumir.
//
// Variáveis de ambiente necessárias (configurar em Vercel > Project Settings > Environment Variables):
//   CLICKUP_API_TOKEN        - token pessoal/API da sua conta ClickUp
//   CLICKUP_LIST_ATIVIDADES  - ID da lista Atividades (901002094100)

const STATUS_BADGE_MAP = {
  'aberto': { label: 'Aberto', cls: 'badge-aberto' },
  'pendente': { label: 'Pendente', cls: 'badge-pendente' },
  'em andamento': { label: 'Em andamento', cls: 'badge-andamento' },
  'ag. retorno usuario': { label: 'Ag. retorno usuário', cls: 'badge-ag-usuario' },
  'finalizado, em acomp.': { label: 'Finalizado, em acomp.', cls: 'badge-concluido' },
  'finalizado, em revisão': { label: 'Finalizado, em revisão', cls: 'badge-concluido' },
  'finalizado': { label: 'Finalizado', cls: 'badge-concluido' }
};

const CLOSED_STATUSES = ['finalizado, em acomp.', 'finalizado, em revisão', 'finalizado'];

function priorityClass(priority) {
  if (!priority) return 'priority-none';
  const p = (priority.priority || '').toLowerCase();
  if (p === 'urgent') return 'priority-urgent';
  if (p === 'high') return 'priority-high';
  if (p === 'normal') return 'priority-normal';
  return 'priority-none';
}

function isHighPriority(priority) {
  if (!priority) return false;
  const p = (priority.priority || '').toLowerCase();
  return p === 'urgent' || p === 'high';
}

function hasTagToday(tags) {
  return (tags || []).some(function (t) { return t.name === 'pra hoje'; });
}

function isLate(dueDateMs) {
  if (!dueDateMs) return false;
  return parseInt(dueDateMs, 10) < Date.now();
}

function dueDateLabel(dueDateMs) {
  if (!dueDateMs) return '—';
  const d = new Date(parseInt(dueDateMs, 10));
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function agingClassFromDue(dueDateMs) {
  if (!dueDateMs) return '';
  const diffDays = Math.floor((Date.now() - parseInt(dueDateMs, 10)) / (1000 * 60 * 60 * 24));
  if (diffDays >= 7) return 'crit';
  if (diffDays > 0) return 'warn';
  return '';
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  const token = process.env.CLICKUP_API_TOKEN;
  const listId = process.env.CLICKUP_LIST_ATIVIDADES || '901002094100';

  if (!token) {
    res.status(500).json({ error: 'CLICKUP_API_TOKEN não configurado nas variáveis de ambiente.' });
    return;
  }

  try {
    const url = `https://api.clickup.com/api/v2/list/${listId}/task?include_closed=false&order_by=due_date`;
    const response = await fetch(url, {
      headers: { Authorization: token }
    });

    if (!response.ok) {
      const text = await response.text();
      res.status(response.status).json({ error: 'Erro ao consultar ClickUp', detail: text });
      return;
    }

    const data = await response.json();
    const allTasks = (data.tasks || []).filter(function (t) {
      const statusName = (t.status && t.status.status || '').toLowerCase();
      return CLOSED_STATUSES.indexOf(statusName) === -1;
    });

    const relevant = allTasks.filter(function (t) {
      return isHighPriority(t.priority) || hasTagToday(t.tags) || isLate(t.due_date);
    });

    // ordena por mais atrasado primeiro (due_date mais antigo primeiro; sem due_date vai pro fim)
    relevant.sort(function (a, b) {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return parseInt(a.due_date, 10) - parseInt(b.due_date, 10);
    });

    const tasks = relevant.map(function (t) {
      const statusName = (t.status && t.status.status || '').toLowerCase();
      const badge = STATUS_BADGE_MAP[statusName] || { label: t.status ? t.status.status : '—', cls: 'badge-aberto' };

      return {
        id: t.custom_id || t.id,
        name: t.name,
        status: statusName,
        statusLabel: badge.label,
        statusClass: badge.cls,
        priorityClass: priorityClass(t.priority),
        assignees: (t.assignees || []).map(function (a) { return a.username; }),
        tags: (t.tags || []).map(function (tg) { return tg.name; }),
        isToday: hasTagToday(t.tags),
        isLate: isLate(t.due_date),
        dueLabel: dueDateLabel(t.due_date),
        agingClass: agingClassFromDue(t.due_date),
        url: t.url
      };
    });

    res.status(200).json({
      updatedAt: new Date().toISOString(),
      totalOpen: allTasks.length,
      totalRelevant: tasks.length,
      lateCount: tasks.filter(function (t) { return t.isLate; }).length,
      highPriorityCount: allTasks.filter(function (t) { return isHighPriority(t.priority); }).length,
      todayCount: allTasks.filter(function (t) { return hasTagToday(t.tags); }).length,
      tasks: tasks
    });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao buscar dados do ClickUp', detail: err.message });
  }
};
