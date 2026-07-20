const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
require('dotenv').config({ override: true });

let currentLat = 30.2672;
let currentLng = -97.7431;
let currentSpeed = 65;
let totalDistance = 0;

function setupTrackingSocket(server) {
  const wss = new WebSocket.Server({ server, path: '/ws/tracking' });

  wss.on('connection', (ws, req) => {
    console.log('🔌 Client connecté au tracking WebSocket');

    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    try {
      jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      ws.send(JSON.stringify({ error: 'Token invalide.' }));
      ws.close();
      return;
    }

    const interval = setInterval(() => {
      currentLat += (Math.random() - 0.5) * 0.002;
      currentLng += (Math.random() - 0.5) * 0.002;
      currentSpeed = 55 + Math.random() * 25;
      totalDistance += currentSpeed * (3 / 3600);

      const position = {
        vehicleId: '1',
        lat: currentLat,
        lng: currentLng,
        speed: Math.round(currentSpeed * 10) / 10,
        distance: Math.round(totalDistance * 100) / 100,
        timestamp: new Date().toISOString(),
      };

      ws.send(JSON.stringify(position));
    }, 3000);

    ws.on('close', () => {
      console.log('🔌 Client déconnecté du tracking WebSocket');
      clearInterval(interval);
    });
  });

  console.log('📡 WebSocket tracking prêt sur /ws/tracking');
}

module.exports = setupTrackingSocket;