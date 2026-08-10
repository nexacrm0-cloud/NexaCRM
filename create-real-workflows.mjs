import http from 'http';
import { readFileSync } from 'fs';

const N8N_URL = 'http://localhost:5678';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjYWRhMDdmNi00ZWIwLTQ0NTctODQ2Ny1hYzRkMTA0MDdlZDIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOWRiODZmMmItYzU5YS00MmM5LTkxODMtNjUxODBkMDZkZDk0IiwiaWF0IjoxNzgyODUxNTQ2fQ.eaexEkStmXbQSrWDDnQaW3b7wKBk9U5195QEZFql3tM';
const INTERNAL_KEY = 'nexa-internal-2024';
const NEXA_INTERNAL = 'http://host.docker.internal:4000/api/v1/internal';
const NEXA_CALLBACK = 'http://host.docker.internal:4000/api/v1/webhooks/agents/callback';

function n8nReq(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, N8N_URL);
    const bodyStr = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: url.hostname, port: url.port, path: url.pathname, method,
      headers: { 'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json', ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function cbExpr() {
  return "={{ JSON.stringify({ executionId: $('Webhook').first().json.body.executionId, agentId: $('Webhook').first().json.body.agentId, organizationId: $('Webhook').first().json.body.organizationId, status: 'COMPLETED', output: $json }) }}";
}

function webhookNode(name, path, pos) {
  return {
    parameters: { httpMethod: 'POST', path, responseMode: 'onReceived', options: {} },
    name: 'Webhook',
    type: 'n8n-nodes-base.webhook',
    typeVersion: 2,
    position: pos,
    webhookId: path,
  };
}

function fetchNode(url, pos) {
  const baseUrl = url.replace('/orgId', '/');
  return {
    parameters: {
      url: '={{ "' + baseUrl + '" + $json.body.organizationId }}',
      method: 'GET',
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'x-internal-api-key', value: INTERNAL_KEY }] },
      options: {},
    },
    name: 'Fetch Data',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: pos,
  };
}

function codeNode(jsCode, pos) {
  return {
    parameters: { jsCode },
    name: 'Analyze',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: pos,
  };
}

function callbackNode(pos) {
  return {
    parameters: {
      url: NEXA_CALLBACK,
      method: 'POST',
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'x-internal-api-key', value: INTERNAL_KEY }] },
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: cbExpr(),
      options: {},
    },
    name: 'Callback Nexa',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: pos,
  };
}

const SALES_CODE = `
const data = $input.first().json;
const summary = data.summary || {};
const stages = data.stages || [];
const insights = [];

if (summary.staleDealsCount > 0) {
  insights.push({
    type: 'WARNING',
    title: summary.staleDealsCount + ' deal(s) sin actividad > 14 dias',
    details: summary.staleDeals.map(function(d) {
      return d.title + ' ($' + d.value + ') - ' + d.daysSinceActivity + 'd sin actividad - ' + (d.assignee || 'Sin asignar');
    }),
  });
}

var totalValue = summary.totalValue || 0;
insights.push({
  type: 'INFO',
  title: 'Resumen del Pipeline',
  details: [
    'Total deals: ' + (summary.totalDeals || 0),
    'Valor total: $' + totalValue.toLocaleString(),
    'Deals ganados: ' + (summary.wonCount || 0),
    'Deals perdidos: ' + (summary.lostCount || 0),
    'Tasa de conversion: ' + (summary.totalDeals > 0 ? Math.round((summary.wonCount / summary.totalDeals) * 100) : 0) + '%',
  ],
});

if (summary.staleDealsCount > 3) {
  insights.push({
    type: 'ACTION',
    title: 'Recomendacion: Revisar deals estancados',
    details: ['Considerar hacer follow-up con prospectos', 'Revisar estrategia de pricing o propuesta de valor'],
  });
}

return [{ json: { insights: insights, summary: summary, timestamp: new Date().toISOString() } }];
`;

const FOLLOWUP_CODE = `
const data = $input.first().json;
const insights = [];

if (data.staleClientsCount > 0) {
  insights.push({
    type: 'WARNING',
    title: data.staleClientsCount + ' cliente(s) sin contacto > 14 dias',
    details: data.staleClients.map(function(c) {
      return c.companyName + ' (' + c.contactName + ') - ' + c.daysSinceActivity + 'd sin contacto - Deals: ' + c.openDeals + ' - Quotes: ' + c.pendingQuotes;
    }),
  });
}

if (data.overdueInvoices.length > 0) {
  var totalOwed = data.overdueInvoices.reduce(function(sum, i) { return sum + i.total; }, 0);
  insights.push({
    type: 'ALERT',
    title: data.overdueInvoices.length + ' factura(s) vencida(s) - Total: $' + totalOwed.toLocaleString(),
    details: data.overdueInvoices.map(function(i) {
      return 'Factura ' + i.invoiceNumber + ' - ' + i.clientName + ' - $' + i.total;
    }),
  });
}

if (data.clientsNeedingAttention.length > 0) {
  insights.push({
    type: 'ACTION',
    title: data.clientsNeedingAttention.length + ' cliente(s) necesitan atencion',
    details: data.clientsNeedingAttention.map(function(c) {
      var parts = [c.companyName];
      if (c.pendingQuotes.length > 0) parts.push('Quotes pendientes: ' + c.pendingQuotes.map(function(q) { return q.number; }).join(', '));
      if (c.overdueInvoices.length > 0) parts.push('Facturas vencidas: ' + c.overdueInvoices.map(function(i) { return i.number; }).join(', '));
      return parts.join(' - ');
    }),
  });
}

insights.push({
  type: 'INFO',
  title: 'Resumen de Clientes',
  details: [
    'Total clientes: ' + data.totalClients,
    'Sin contacto reciente: ' + data.staleClientsCount,
    'Facturas vencidas: ' + data.overdueInvoices.length,
  ],
});

return [{ json: { insights: insights, totalClients: data.totalClients, staleCount: data.staleClientsCount, timestamp: new Date().toISOString() } }];
`;

const ANALYST_CODE = `
const data = $input.first().json;
const insights = [];
var r = data.revenue || {};
var p = data.pipeline || {};
var t = data.tasks || {};
var c = data.clients || {};

insights.push({
  type: 'INFO',
  title: 'Metricas del Negocio (ultimos 30 dias)',
  details: [
    'Revenue total: $' + (r.totalRevenue || 0).toLocaleString(),
    'Pipeline activo: $' + (r.totalPipeline || 0).toLocaleString(),
    'Forecast: $' + Math.round(r.forecast || 0).toLocaleString(),
    'Tasa de conversion: ' + Math.round(p.conversionRate || 0) + '%',
    'Ciclo promedio del deal: ' + (p.avgDealCycleDays || 0) + ' dias',
  ],
});

insights.push({
  type: 'INFO',
  title: 'Operaciones',
  details: [
    'Deals activos: ' + (p.activeDeals || 0) + ' / ' + (p.totalDeals || 0) + ' total',
    'Tareas completadas: ' + (t.completed || 0) + ' / ' + (t.total || 0),
    'Tareas vencidas: ' + (t.overdue || 0),
    'Tasa de completado: ' + Math.round(t.completionRate || 0) + '%',
    'Clientes nuevos este mes: ' + (c.newThisMonth || 0),
  ],
});

if (data.topPerformers && data.topPerformers.length > 0) {
  insights.push({
    type: 'INFO',
    title: 'Top Performers',
    details: data.topPerformers.map(function(tp, i) {
      return (i + 1) + '. ' + tp.name + ': $' + tp.value.toLocaleString();
    }),
  });
}

if (p.conversionRate < 20) {
  insights.push({
    type: 'ACTION',
    title: 'Tasa de conversion baja',
    details: ['Revisar calidad de leads entrantes', 'Evaluar propuesta de valor y pricing', 'Considerar capacitacion del equipo de ventas'],
  });
}

if (t.overdue > 5) {
  insights.push({
    type: 'WARNING',
    title: t.overdue + ' tareas vencidas - posible cuello de botella',
    details: ['Reasignar prioridades', 'Considerar recursos adicionales'],
  });
}

return [{ json: { insights: insights, metrics: { revenue: r, pipeline: p, tasks: t }, timestamp: new Date().toISOString() } }];
`;

const OPERATIONS_CODE = `
const data = $input.first().json;
const insights = [];
var s = data.summary || {};

insights.push({
  type: 'INFO',
  title: 'Resumen de Tareas',
  details: [
    'Total: ' + (s.total || 0),
    'Pendientes: ' + (s.pending || 0),
    'En progreso: ' + (s.inProgress || 0),
    'Completadas: ' + (s.completed || 0),
    'Vencidas: ' + (s.overdue || 0),
    'Vencen hoy: ' + (s.dueToday || 0),
    'Vencen esta semana: ' + (s.dueThisWeek || 0),
  ],
});

if (data.overdueTasks && data.overdueTasks.length > 0) {
  insights.push({
    type: 'ALERT',
    title: data.overdueTasks.length + ' tarea(s) vencida(s)',
    details: data.overdueTasks.slice(0, 10).map(function(t) {
      return '[' + t.priority + '] ' + t.title + ' - ' + t.daysOverdue + 'd vencida - ' + (t.assignee || 'Sin asignar') + (t.client ? ' - ' + t.client : '');
    }),
  });
}

if (data.workload && data.workload.length > 0) {
  var overloaded = data.workload.filter(function(w) { return w.overdueTasks > 2 || w.urgentTasks > 2; });
  if (overloaded.length > 0) {
    insights.push({
      type: 'WARNING',
      title: 'Miembros con carga excesiva',
      details: overloaded.map(function(w) {
        return w.name + ': ' + w.totalTasks + ' tareas, ' + w.overdueTasks + ' vencidas, ' + w.urgentTasks + ' urgentes';
      }),
    });
  }

  insights.push({
    type: 'INFO',
    title: 'Distribucion de Carga',
    details: data.workload.map(function(w) {
      return w.name + ': ' + w.totalTasks + ' tareas activas (' + w.overdueTasks + ' vencidas, ' + w.urgentTasks + ' urgentes)';
    }),
  });
}

if (s.overdue > 10) {
  insights.push({
    type: 'ACTION',
    title: 'Alto numero de tareas vencidas',
    details: ['Considerar reunion de planificacion', 'Revisar capacidad del equipo', 'Priorizar tareas criticas'],
  });
}

return [{ json: { insights: insights, summary: s, workload: data.workload, timestamp: new Date().toISOString() } }];
`;

const workflows = [
  {
    name: 'Nexa Sales Agent',
    path: 'sales-agent',
    fetchUrl: NEXA_INTERNAL + '/pipeline/orgId',
    code: SALES_CODE,
  },
  {
    name: 'Nexa Follow-up Agent',
    path: 'followup-agent',
    fetchUrl: NEXA_INTERNAL + '/clients/orgId',
    code: FOLLOWUP_CODE,
  },
  {
    name: 'Nexa Business Analyst Agent',
    path: 'analyst-agent',
    fetchUrl: NEXA_INTERNAL + '/metrics/orgId',
    code: ANALYST_CODE,
  },
  {
    name: 'Nexa Operations Agent',
    path: 'operations-agent',
    fetchUrl: NEXA_INTERNAL + '/tasks/orgId',
    code: OPERATIONS_CODE,
  },
];

async function main() {
  console.log('Deleting all workflows...');
  const existing = await n8nReq('GET', '/api/v1/workflows');
  for (const wf of (existing.data || [])) {
    if (wf.active) await n8nReq('POST', '/api/v1/workflows/' + wf.id + '/deactivate');
    await n8nReq('DELETE', '/api/v1/workflows/' + wf.id);
  }
  console.log('Cleared\n');

  for (const wf of workflows) {
    const wfDef = {
      name: wf.name,
      nodes: [
        webhookNode('Webhook', wf.path, [240, 300]),
        fetchNode(wf.fetchUrl, [500, 300]),
        codeNode(wf.code, [740, 300]),
        callbackNode([980, 300]),
      ],
      connections: {
        Webhook: { main: [[{ node: 'Fetch Data', type: 'main', index: 0 }]] },
        'Fetch Data': { main: [[{ node: 'Analyze', type: 'main', index: 0 }]] },
        Analyze: { main: [[{ node: 'Callback Nexa', type: 'main', index: 0 }]] },
      },
      settings: { executionOrder: 'v1' },
    };

    const result = await n8nReq('POST', '/api/v1/workflows', wfDef);
    if (result.id) {
      await n8nReq('POST', '/api/v1/workflows/' + result.id + '/activate');
      console.log('OK: ' + wf.name + ' (ID: ' + result.id + ')');
    } else {
      console.log('ERR: ' + wf.name + ': ' + JSON.stringify(result).substring(0, 200));
    }
  }

  console.log('\nDone - all workflows created and activated');
}

main().catch(console.error);
