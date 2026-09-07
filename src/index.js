const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

require('dotenv').config({
  override: true,
});

const authRoutes = require('./routes/authRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const alertRoutes = require('./routes/alertRoutes');
const tripRoutes = require('./routes/tripRoutes');
const geofenceRoutes = require('./routes/geofenceRoutes');

const setupTrackingSocket = require('./websocket/trackingSocket');

const {
  startOfflineVehicleWatcher,
} = require('./services/offlineVehicleService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'API Auto24 GPS en ligne 🚀',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api', vehicleRoutes);
app.use('/api', alertRoutes);
app.use('/api', tripRoutes);
app.use('/api/geofences', geofenceRoutes);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log('✅ Nouveau client connecté :', socket.id);

  socket.on('disconnect', () => {
    console.log('❌ Client déconnecté :', socket.id);
  });
});

setupTrackingSocket(server);

startOfflineVehicleWatcher();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});