// api/helpdesk-data.js
// Endpoint serverless da Vercel: busca tasks abertas da lista Helpdesk no ClickUp
// e devolve um JSON já processado para o painel consumir.
//
// Variáveis de ambiente necessárias (configurar em Vercel > Project Settings > Environment Variables):
//   CLICKUP_API_TOKEN      - token pessoal/API da sua conta ClickUp
//   CLICKUP_LIST_HELPDESK  - ID da lista Helpdesk (901318874855)

const STATUS_BADGE_MAP = {
  'aberto': { label: 'Aberto', cls: 'badge-aberto' },
  'em atendimento': { label: 'Em atendimento', cls: 'badge-atendimento' },
  'aguardando retorno': { label: 'Aguardando retorno', cls: 'badge-aguardando' },
  'retorno terceiro': { label: 'Retorno terceiro', cls: 'badge-terceiro' },
  'concluido': { label: 'Concluído', cls: 'badge-concluido' }
};

function priorityClass(priority) {
  if (!priority) return 'priority-none';
  const p = (priority.priority || priority).toLowerCase ? (priority.priority || priority).toLowerCase() : '';
  if (p === 'urgent') return 'priority-urgent';
  if (p === 'high') return 'priority-high';
  if (p === 'normal') return 'priority-normal';
  return 'priority-none';
}

function agingDays(dateCreatedMs) {
  if (!dateCreatedMs) return null;
  const created = parseInt(dateCreatedMs, 10);
  const diffMs = Date.now() - created;
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function agingClass(days) {
  if (days === null) return '';
  if (days >= 14) return 'crit';
  if (days >= 7) return 'warn';
  return '';
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  const token = process.env.CLICKUP_API_TOKEN;
  const listId = process.env.CLICKUP_LIST_HELPDESK || '901318874855';

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
    const tasks = (data.tasks || []).map(function (t) {
      const statusName = (t.status && t.status.status || '').toLowerCase();
      const badge = STATUS_BADGE_MAP[statusName] || { label: t.status ? t.status.status : '—', cls: 'badge-aberto' };
      const days = agingDays(t.date_created);

      return {
        id: t.custom_id || t.id,
        name: t.name,
        status: statusName,
        statusLabel: badge.label,
        statusClass: badge.cls,
        priorityClass: priorityClass(t.priority),
        assignees: (t.assignees || []).map(function (a) { return a.username; }),
        agingDays: days,
        agingClass: agingClass(days),
        url: t.url
      };
    });

    const statusCounts = {};
    Object.keys(STATUS_BADGE_MAP).forEach(function (k) { statusCounts[k] = 0; });
    tasks.forEach(function (t) {
      if (statusCounts[t.status] !== undefined) statusCounts[t.status]++;
    });

    const assigneeCounts = {};
    tasks.forEach(function (t) {
      t.assignees.forEach(function (name) {
        assigneeCounts[name] = (assigneeCounts[name] || 0) + 1;
      });
    });

    res.status(200).json({
      updatedAt: new Date().toISOString(),
      total: tasks.length,
      statusCounts: statusCounts,
      assigneeCounts: assigneeCounts,
      tasks: tasks
    });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao buscar dados do ClickUp', detail: err.message });
  }
};
