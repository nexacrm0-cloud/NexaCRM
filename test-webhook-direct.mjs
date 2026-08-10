import http from 'http';

const body = JSON.stringify({
  executionId: 'test-direct',
  agentId: 'cmr0w63j60000481cek25bhga',
  organizationId: 'cmqyf39c5000048dsxtw8sma6',
  event: 'test',
  payload: { test: true },
});

const req = http.request({
  hostname: 'localhost', port: 5678, path: '/webhook/sales-agent', method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
}, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => console.log(`Status: ${res.statusCode}\nBody: ${data}`));
});
req.on('error', console.error);
req.write(body);
req.end();
