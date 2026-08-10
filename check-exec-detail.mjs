import http from 'http';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjYWRhMDdmNi00ZWIwLTQ0NTctODQ2Ny1hYzRkMTA0MDdlZDIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOWRiODZmMmItYzU5YS00MmM5LTkxODMtNjUxODBkMDZkZDk0IiwiaWF0IjoxNzgyODUxNTQ2fQ.eaexEkStmXbQSrWDDnQaW3b7wKBk9U5195QEZFql3tM';
function n8nGet(path) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: 'localhost', port: 5678, path, headers: { 'X-N8N-API-KEY': API_KEY } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
    }).on('error', reject);
  });
}
async function main() {
  for (const id of [15, 16, 17, 18]) {
    const exec = await n8nGet('/api/v1/executions/' + id + '?includeData=true');
    const err = exec.data?.resultData?.error;
    const lastNode = exec.data?.resultData?.lastNodeExecuted;
    const runData = exec.data?.resultData?.runData;
    console.log('Execution ' + id + ':');
    if (err) {
      console.log('  Error:', err.message);
      console.log('  Desc:', err.description);
    }
    if (lastNode) console.log('  Last node:', lastNode);
    if (runData) {
      for (const [name, runs] of Object.entries(runData)) {
        for (const r of runs) {
          if (r.error) console.log('  ' + name + ' error:', r.error.message);
          if (r.data?.main?.[0]?.[0]?.json) {
            const j = r.data.main[0][0].json;
            console.log('  ' + name + ' output keys:', Object.keys(j).join(', '));
          }
        }
      }
    }
    console.log('');
  }
}
main().catch(console.error);
