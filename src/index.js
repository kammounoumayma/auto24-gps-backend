const express = require('express');
const cors = require('cors');
const http = require('http');
require('dotenv').config({ override: true });

const authRoutes = require('./routes/authRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const alertRoutes = require('./routes/alertRoutes');
const tripRoutes = require('./routes/tripRoutes');
const setupTrackingSocket = require('./websocket/trackingSocket');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'API Auto24 GPS en ligne 🚀' });
});

app.use('/api', authRoutes);
app.use('/api', vehicleRoutes);
app.use('/api', alertRoutes);
app.use('/api', tripRoutes);

const server = http.createServer(app);
setupTrackingSocket(server);

server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});