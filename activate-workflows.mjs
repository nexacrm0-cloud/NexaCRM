import http from 'http';

const N8N_URL = 'http://localhost:5678';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjYWRhMDdmNi00ZWIwLTQ0NTctODQ2Ny1hYzRkMTA0MDdlZDIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOWRiODZmMmItYzU5YS00MmM5LTkxODMtNjUxODBkMDZkZDk0IiwiaWF0IjoxNzgyODUxNTQ2fQ.eaexEkStmXbQSrWDDnQaW3b7wKBk9U5195QEZFql3tM';

function n8nRequest(method, path) {
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
        console.log(`  ${method} ${path} -> ${res.statusCode} ${data.substring(0, 100)}`);
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

const ids = [
  { name: 'Sales Agent', id: 'ZZQC7jSpjpeVCs2C' },
  { name: 'Follow-up Agent', id: 'mWwfl08BcLvYVJg0' },
  { name: 'Business Analyst Agent', id: '2sLirkDfJbyjlsRL' },
  { name: 'Operations Agent', id: 'q3eWPG1FOxHAXHBX' },
];

async function main() {
  for (const wf of ids) {
    // Use activate endpoint
    const result = await n8nRequest('POST', `/api/v1/workflows/${wf.id}/activate`);
    console.log(`${wf.name}: active=${result.active}`);
  }

  // Verify webhook URLs
  const list = await n8nRequest('GET', '/api/v1/workflows');
  console.log('\n=== Workflows & Webhooks ===');
  for (const wf of (list.data || [])) {
    const full = await n8nRequest('GET', `/api/v1/workflows/${wf.id}`);
    const webhookNode = full.nodes?.find(n => n.type === 'n8n-nodes-base.webhook');
    const webhookPath = webhookNode?.parameters?.path || 'none';
    console.log(`  ${wf.name} | Active: ${wf.active} | Webhook: /webhook/${webhookPath}`);
  }
}

main().catch(console.error);
