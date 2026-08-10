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
        console.log(`  Response ${res.statusCode}:`, data.substring(0, 300));
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Test list
  console.log('Testing GET /api/v1/workflows...');
  const list = await n8nRequest('GET', '/api/v1/workflows');
  console.log('List result:', JSON.stringify(list).substring(0, 500));
  
  // Test create one workflow
  console.log('\nTesting POST /api/v1/workflows...');
  const testWf = {
    name: 'Test Workflow',
    nodes: [],
    connections: {},
    active: false,
  };
  const result = await n8nRequest('POST', '/api/v1/workflows', testWf);
  console.log('Create result:', JSON.stringify(result).substring(0, 500));
}

main().catch(console.error);
