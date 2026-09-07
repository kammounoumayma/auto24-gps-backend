-- Utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Véhicules
CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  plate VARCHAR(30) NOT NULL,
  status VARCHAR(20) DEFAULT 'unknown', -- 'online', 'offline', 'unknown'
  last_known_location TEXT,
  current_speed NUMERIC,
  battery_level INTEGER,
  fuel_level INTEGER,
  mileage INTEGER,
  engine_hours NUMERIC,
  next_service_km INTEGER,
  direction VARCHAR(20),
  last_update TIMESTAMP,
  last_position_at TIMESTAMP,           -- utilisé par la surveillance "hors ligne"
  current_geofence_id INTEGER,          -- zone géographique actuelle du véhicule
  created_at TIMESTAMP DEFAULT NOW()
);

-- Trajets
CREATE TABLE IF NOT EXISTS trips (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
  start_location VARCHAR(200),
  end_location VARCHAR(200),
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  distance_km NUMERIC,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Alertes (ANCIENNE TABLE — conservée pour compatibilité, plus utilisée par le code)
-- Voir vehicle_alerts ci-dessous, qui l'a remplacée.
CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Alertes véhicule (table active, utilisée par alertController, trackingSocket, offlineVehicleService)
CREATE TABLE IF NOT EXISTS vehicle_alerts (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,            -- 'speeding', 'geofence', 'offline', ...
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  speed DOUBLE PRECISION,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_read BOOLEAN DEFAULT FALSE
);

-- Zones géographiques (geofencing)
CREATE TABLE IF NOT EXISTS geofences (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Événements d'entrée/sortie de zone géographique
CREATE TABLE IF NOT EXISTS geofence_events (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  geofence_id INTEGER NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
  event_type VARCHAR(20) NOT NULL,      -- 'enter', 'exit'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Historique détaillé des positions GPS (pour l'export PDF et le détail de trajet)
CREATE TABLE IF NOT EXISTS vehicle_positions (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  speed DOUBLE PRECISION DEFAULT 0,
  heading DOUBLE PRECISION DEFAULT 0,
  distance DOUBLE PRECISION DEFAULT 0,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);