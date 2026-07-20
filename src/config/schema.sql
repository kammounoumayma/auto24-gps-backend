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

-- Alertes
CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL, -- 'speeding', 'geofence', 'ignition', 'battery', 'maintenance'
  severity VARCHAR(20) NOT NULL, -- 'critical', 'warning', 'info'
  title VARCHAR(150) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);