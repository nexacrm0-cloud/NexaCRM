import http from 'http';

const N8N_URL = 'http://localhost:5678';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjYWRhMDdmNi00ZWIwLTQ0NTctODQ2Ny1hYzRkMTA0MDdlZDIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOWRiODZmMmItYzU5YS00MmM5LTkxODMtNjUxODBkMDZkZDk0IiwiaWF0IjoxNzgyODUxNTQ2fQ.eaexEkStmXbQSrWDDnQaW3b7wKBk9U5195QEZFql3tM';
const CALLBACK = 'http://host.docker.internal:4000/api/v1/webhooks/agents/callback';

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

async function main() {
  // Delete all
  const existing = await n8nReq('GET', '/api/v1/workflows');
  for (const wf of (existing.data || [])) {
    if (wf.active) await n8nReq('POST', `/api/v1/workflows/${wf.id}/deactivate`);
    await n8nReq('DELETE', `/api/v1/workflows/${wf.id}`);
  }
  console.log('Cleared');

  const agents = [
    { name: 'Nexa Sales Agent', path: 'sales-agent' },
    { name: 'Nexa Follow-up Agent', path: 'followup-agent' },
    { name: 'Nexa Business Analyst Agent', path: 'analyst-agent' },
    { name: 'Nexa Operations Agent', path: 'operations-agent' },
  ];

  for (const agent of agents) {
    const wf = {
      name: agent.name,
      nodes: [
        {
          parameters: { httpMethod: 'POST', path: agent.path, responseMode: 'onReceived', options: {} },
          name: 'Webhook',
          type: 'n8n-nodes-base.webhook',
          typeVersion: 2,
          position: [240, 300],
          webhookId: agent.path,
        },
        {
          parameters: {
            jsCode: `const body = $input.first().json.body;\nreturn [{ json: {\n  executionId: body.executionId || '',\n  agentId: body.agentId || '',\n  organizationId: body.organizationId || '',\n  status: 'COMPLETED',\n  output: { message: 'Agent executed', event: body.event || '', timestamp: new Date().toISOString() }\n}}];`,
          },
          name: 'Prepare Data',
          type: 'n8n-nodes-base.code',
          typeVersion: 2,
          position: [440, 300],
        },
        {
          parameters: {
            url: CALLBACK,
            method: 'POST',
            sendBody: true,
            contentType: 'json',
            specifyBody: 'json',
            jsonBody: '={{ JSON.stringify($json) }}',
            options: {},
          },
          name: 'Callback Nexa',
          type: 'n8n-nodes-base.httpRequest',
          typeVersion: 4.2,
          position: [680, 300],
        },
      ],
      connections: {
        Webhook: { main: [[{ node: 'Prepare Data', type: 'main', index: 0 }]] },
        'Prepare Data': { main: [[{ node: 'Callback Nexa', type: 'main', index: 0 }]] },
      },
      settings: { executionOrder: 'v1' },
    };

    const result = await n8nReq('POST', '/api/v1/workflows', wf);
    if (result.id) {
      await n8nReq('POST', `/api/v1/workflows/${result.id}/activate`);
      console.log(`OK: ${agent.name}`);
    } else {
      console.log(`ERR: ${agent.name}:`, JSON.stringify(result).substring(0, 200));
    }
  }

  // Test
  console.log('\nTesting...');
  const body = JSON.stringify({ executionId: 'test-001', agentId: 'test', organizationId: 'cmqyf39c5000048dsxtw8sma6', event: 'client.created', payload: {} });
  const testResult = await new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost', port: 5678, path: '/webhook/sales-agent', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.write(body);
    req.end();
  });
  console.log(`Webhook: ${testResult.status} - ${testResult.body}`);

  await new Promise(r => setTimeout(r, 8000));
  const execs = await n8nReq('GET', '/api/v1/executions');
  for (const e of (execs.data || [])) {
    console.log(`Execution ${e.id}: ${e.status}`);
  }
}

main().catch(console.error);
