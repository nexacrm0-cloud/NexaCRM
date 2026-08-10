import http from 'http';

function httpReq(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: 'localhost', port: 4000, path, method,
      headers: { 'Content-Type': 'application/json', ...headers, ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) },
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
  const login = await httpReq('POST', '/api/v1/auth/login', { email: 'test@nexacrm.com', password: 'Test123!' });
  const token = login.data.accessToken;
  const headers = { Authorization: 'Bearer ' + token };
  const orgId = 'cmqyf39c5000048dsxtw8sma6';

  const agents = await httpReq('GET', '/api/v1/agents', null, headers);
  console.log('Agents found:', agents.length);

  for (const agent of agents) {
    console.log('\n--- Triggering: ' + agent.name + ' (' + agent.type + ') ---');
    const trigger = await httpReq('POST', '/api/v1/webhooks/agents/trigger', {
      agentId: agent.id,
      organizationId: orgId,
      event: 'manual.trigger',
      payload: {},
    }, headers);
    console.log('Trigger result:', trigger.executionId || trigger.error || JSON.stringify(trigger));
  }

  console.log('\nWaiting 15 seconds for n8n to process...');
  await new Promise(r => setTimeout(r, 15000));

  console.log('\n=== Results ===');
  for (const agent of agents) {
    const logs = await httpReq('GET', '/api/v1/agents/' + agent.id + '/logs?limit=1', null, headers);
    const latest = logs[0];
    if (latest) {
      console.log('\n' + agent.name + ':');
      console.log('  Status:', latest.status);
      console.log('  Duration:', latest.durationMs ? latest.durationMs + 'ms' : 'pending');
      if (latest.output) {
        const insights = latest.output.insights || [];
        console.log('  Insights:', insights.length);
        for (const ins of insights.slice(0, 3)) {
          console.log('    [' + ins.type + '] ' + ins.title);
          if (ins.details) {
            for (const d of (Array.isArray(ins.details) ? ins.details.slice(0, 2) : [ins.details])) {
              console.log('      - ' + d);
            }
          }
        }
      }
      if (latest.error) console.log('  Error:', latest.error);
    }
  }
}

main().catch(console.error);
