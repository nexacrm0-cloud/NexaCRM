import http from 'http';

const N8N_URL = 'http://localhost:5678';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjYWRhMDdmNi00ZWIwLTQ0NTctODQ2Ny1hYzRkMTA0MDdlZDIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOWRiODZmMmItYzU5YS00MmM5LTkxODMtNjUxODBkMDZkZDk0IiwiaWF0IjoxNzgyODUxNTQ2fQ.eaexEkStmXbQSrWDDnQaW3b7wKBk9U5195QEZFql3tM';

function n8nGet(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, N8N_URL);
    http.get({ hostname: url.hostname, port: url.port, path: url.pathname, headers: { 'X-N8N-API-KEY': API_KEY } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
    }).on('error', reject);
  });
}

async function main() {
  const execs = await n8nGet('/api/v1/executions');
  console.log('n8n Executions:');
  for (const e of (execs.data || [])) {
    console.log(`  ID: ${e.id} | Status: ${e.status} | Workflow: ${e.workflowId} | Started: ${e.startedAt}`);
    if (e.data?.resultData?.error) {
      console.log(`  Error: ${e.data.resultData.error.message}`);
    }
  }

  const workflows = await n8nGet('/api/v1/workflows');
  console.log('\nWorkflows:');
  for (const wf of (workflows.data || [])) {
    console.log(`  ${wf.name} | Active: ${wf.active} | ID: ${wf.id}`);
  }
}

main().catch(console.error);
