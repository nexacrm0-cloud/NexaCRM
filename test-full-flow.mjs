import http from 'http';

// 1. Login to Nexa
function httpPost(path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost', port: 4000, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr), ...headers },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

async function main() {
  // Login
  const login = await httpPost('/api/v1/auth/login', { email: 'test@nexacrm.com', password: 'Test123!' });
  const token = login.data.accessToken;
  console.log('Logged in as OWNER');

  // Get Sales Agent
  const agents = await new Promise((resolve, reject) => {
    http.get('http://localhost:4000/api/v1/agents', { headers: { Authorization: `Bearer ${token}` } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
    }).on('error', reject);
  });
  
  const salesAgent = agents.find(a => a.type === 'sales');
  console.log(`Sales Agent: ${salesAgent.id} | webhook: ${salesAgent.webhookUrl}`);

  // Trigger via Nexa webhook
  const trigger = await httpPost('/api/v1/webhooks/agents/trigger', {
    agentId: salesAgent.id,
    organizationId: 'cmqyf39c5000048dsxtw8sma6',
    event: 'client.created',
    payload: { clientName: 'Empresa Test SRL', email: 'contacto@empresa-test.com' },
  });
  console.log(`Triggered execution: ${trigger.executionId}`);

  // Wait 3 seconds for n8n to process
  await new Promise(r => setTimeout(r, 3000));

  // Check execution status
  const metrics = await new Promise((resolve, reject) => {
    http.get(`http://localhost:4000/api/v1/agents/${salesAgent.id}/metrics`, { headers: { Authorization: `Bearer ${token}` } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
    }).on('error', reject);
  });
  console.log('\n=== Metrics ===');
  console.log(JSON.stringify(metrics, null, 2));

  // Check logs
  const logs = await new Promise((resolve, reject) => {
    http.get(`http://localhost:4000/api/v1/agents/${salesAgent.id}/logs`, { headers: { Authorization: `Bearer ${token}` } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
    }).on('error', reject);
  });
  console.log('\n=== Latest Execution ===');
  if (logs.length > 0) {
    console.log(`Status: ${logs[0].status}`);
    console.log(`Duration: ${logs[0].durationMs}ms`);
    console.log(`Output:`, logs[0].output);
  }
}

main().catch(console.error);
