import http from 'http';

const N8N_URL = 'http://localhost:5678';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjYWRhMDdmNi00ZWIwLTQ0NTctODQ2Ny1hYzRkMTA0MDdlZDIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOWRiODZmMmItYzU5YS00MmM5LTkxODMtNjUxODBkMDZkZDk0IiwiaWF0IjoxNzgyODUxNTQ2fQ.eaexEkStmXbQSrWDDnQaW3b7wKBk9U5195QEZFql3tM';

function n8nRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, N8N_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type': 'application/json',
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const NEXA_CALLBACK = 'http://host.docker.internal:4000/api/v1/webhooks/agents/callback';

function makeWebhookAgent(name, webhookId) {
  return {
    name,
    nodes: [
      {
        parameters: { httpMethod: 'POST', path: webhookId, responseMode: 'onReceived', options: {} },
        name: 'Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 2,
        position: [240, 300],
        webhookId,
      },
      {
        parameters: {
          url: NEXA_CALLBACK,
          method: 'POST',
          sendBody: true,
          bodyParameters: {
            parameters: [
              { name: 'executionId', value: '={{ $json.body.executionId }}' },
              { name: 'agentId', value: '={{ $json.body.agentId }}' },
              { name: 'organizationId', value: '={{ $json.body.organizationId }}' },
              { name: 'status', value: 'COMPLETED' },
            ],
          },
          options: {},
        },
        name: 'Callback Nexa',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: [600, 300],
      },
    ],
    connections: {
      Webhook: { main: [[{ node: 'Callback Nexa', type: 'main', index: 0 }]] },
    },
    settings: { executionOrder: 'v1' },
  };
}

async function main() {
  // First delete test workflow
  const list = await n8nRequest('GET', '/api/v1/workflows');
  for (const wf of (list.data || [])) {
    await n8nRequest('DELETE', `/api/v1/workflows/${wf.id}`);
    console.log(`Deleted: ${wf.name}`);
  }

  const agents = [
    { name: 'Nexa Sales Agent', webhookId: 'sales-agent' },
    { name: 'Nexa Follow-up Agent', webhookId: 'followup-agent' },
    { name: 'Nexa Business Analyst Agent', webhookId: 'analyst-agent' },
    { name: 'Nexa Operations Agent', webhookId: 'operations-agent' },
  ];

  for (const agent of agents) {
    const wf = makeWebhookAgent(agent.name, agent.webhookId);
    const result = await n8nRequest('POST', '/api/v1/workflows', wf);
    if (result.id) {
      console.log(`Created: ${agent.name} (ID: ${result.id})`);
      // Activate
      const activate = await n8nRequest('PATCH', `/api/v1/workflows/${result.id}`, { active: true });
      console.log(`  Active: ${activate.active}`);
    } else {
      console.log(`Error creating ${agent.name}:`, JSON.stringify(result));
    }
  }

  // Final list
  const final = await n8nRequest('GET', '/api/v1/workflows');
  console.log('\n=== Workflows in n8n ===');
  for (const wf of (final.data || [])) {
    console.log(`  ${wf.name} | ID: ${wf.id} | Active: ${wf.active}`);
  }
}

main().catch(console.error);
