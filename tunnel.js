const localtunnel = require('localtunnel');
(async () => {
  try {
    const tunnel = await localtunnel({ port: 3000 });
    console.log('TUNNEL_URL:' + tunnel.url);
  } catch (err) {
    console.error('TUNNEL_ERROR:' + err.message);
  }
})();
