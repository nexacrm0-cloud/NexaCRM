import http from 'http';

const WORKFLOWS = {
  sales: 'http://localhost:5678/webhook/sales-agent',
  follow_up: 'http://localhost:5678/webhook/followup-agent',
  business_analyst: 'http://localhost:5678/webhook/analyst-agent',
  operations: 'http://localhost:5678/webhook/operations-agent',
};

const WORKFLOW_URLS = {
  sales: 'http://localhost:5678/workflow/OrGd2eyrwVeAaFGZ',
  follow_up: 'http://localhost:5678/workflow/aEI6C9W9kaykT9Zr',
  business_analyst: 'http://localhost:5678/workflow/S0Q4E3aHp0g01dxm',
  operations: 'http://localhost:5678/workflow/xoIO4Yu1k7r0Zp1f',
};

async function main() {
  const loginBody = JSON.stringify({ email: 'test@nexacrm.com', password: 'Test123!' });
  const login = await new Promise((resolve, reject) => {
    const req = http.request({ hostname: 'localhost', port: 4000, path: '/api/v1/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginBody) } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.write(loginBody);
    req.end();
  });
  const token = login.data.accessToken;

  const agentsRes = await new Promise((resolve, reject) => {
    http.get({ hostname: 'localhost', port: 4000, path: '/api/v1/agents', headers: { Authorization: 'Bearer ' + token } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  for (const agent of agentsRes) {
    const webhookUrl = WORKFLOWS[agent.type];
    const workflowUrl = WORKFLOW_URLS[agent.type];
    if (webhookUrl) {
      console.log(agent.type + ': ' + agent.name + ' -> ' + webhookUrl);
    }
  }
}

main().catch(console.error);
