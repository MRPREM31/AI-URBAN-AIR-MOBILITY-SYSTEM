const localtunnel = require('localtunnel');
const fs = require('fs');

(async () => {
  try {
    const tunnel = await localtunnel({ port: 5173 });
    console.log('Tunnel started at:', tunnel.url);
    fs.writeFileSync('d:\\UrbanAirTaxiSimulation\\tunnel.txt', tunnel.url);
    
    // Keep process alive
    tunnel.on('close', () => {
      console.log('tunnel closed');
    });
  } catch (err) {
    console.error(err);
  }
})();
