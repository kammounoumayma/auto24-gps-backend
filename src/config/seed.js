const bcrypt = require('bcrypt');
const pool = require('./database');

async function seed() {
  const hashedPassword = await bcrypt.hash('password123', 10);

  const userResult = await pool.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    ['Admin User', 'admin@gpsauto24.com', hashedPassword]
  );

  const userId = userResult.rows[0].id;

  await pool.query(`DELETE FROM vehicles WHERE owner_id = $1`, [userId]);

  await pool.query(
    `INSERT INTO vehicles
     (owner_id, name, plate, status, last_known_location, current_speed, battery_level, fuel_level, mileage, engine_hours, next_service_km, direction, last_update)
     VALUES
     ($1, 'Volvo FH16', 'TX-8492-AUS', 'online', 'Autoroute I-35 Nord, Sortie 234, Austin, Texas', 65, 84, 78, 42850, 1248, 2150, 'Nord-Est', NOW()),
     ($1, 'Renault Clio', '204 TUN 8832', 'online', 'Avenue Habib Bourguiba, Sousse', 34, 91, 55, 18200, NULL, NULL, NULL, NOW()),
     ($1, 'Citroën C3', '177 TUN 1290', 'unknown', 'Zone industrielle, Sousse', NULL, 40, NULL, NULL, NULL, NULL, NULL, NULL),
     ($1, 'Dacia Duster', '220 TUN 6674', 'offline', 'Dernière position : Monastir', NULL, 12, NULL, NULL, NULL, NULL, NULL, NULL)
    `,
    [userId]
  );

  const vehiclesResult = await pool.query(
    `SELECT id, name FROM vehicles WHERE owner_id = $1 ORDER BY id`,
    [userId]
  );
  const vehicleIds = vehiclesResult.rows.map((v) => v.id);

  await pool.query(`DELETE FROM alerts WHERE vehicle_id = ANY($1)`, [vehicleIds]);

  await pool.query(
    `INSERT INTO alerts (vehicle_id, type, severity, title, description, created_at)
     VALUES
     ($1, 'speeding', 'critical', 'Excès de vitesse', 'Volvo FH16 a dépassé la limite de vitesse. Détecté à 105 km/h sur I-35.', NOW() - INTERVAL '2 minutes'),
     ($2, 'geofence', 'warning', 'Entrée de zone', 'Renault Clio est entré dans la "Zone Entrepôt Brooklyn".', NOW() - INTERVAL '15 minutes'),
     (NULL, 'ignition', 'info', 'Contact activé', 'Le moteur a démarré sur Ford F-150. Chauffeur : Mike Johnson.', NOW() - INTERVAL '42 minutes'),
     (NULL, 'battery', 'warning', 'Batterie faible', 'Batterie du traceur faible sur Remorque #402. Niveau actuel : 12%.', NOW() - INTERVAL '22 hours'),
     ($1, 'maintenance', 'info', 'Rappel d''entretien', 'Vidange programmée pour Volvo FH16.', NOW() - INTERVAL '1 day 2 hours')
    `,
    [vehicleIds[0], vehicleIds[1]]
  );

  await pool.query(`DELETE FROM trips WHERE vehicle_id = ANY($1)`, [vehicleIds]);

  await pool.query(
    `INSERT INTO trips (vehicle_id, start_location, end_location, start_time, end_time, distance_km)
     VALUES
     ($1, 'North Logistics Hub', 'Austin Warehouse B', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '4 hours 30 minutes', 142.8),
     ($1, 'Austin Warehouse B', 'Port Terminal 4', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours 15 minutes', 34.2),
     ($1, 'Central Depot', 'North Logistics Hub', NOW() - INTERVAL '1 day 8 hours', NOW() - INTERVAL '1 day 4 hours 30 minutes', 210.5),
     ($2, 'Domicile', 'Bureau', NOW() - INTERVAL '18 hours', NOW() - INTERVAL '17 hours 46 minutes', 14.3),
     ($2, 'Bureau', 'Domicile', NOW() - INTERVAL '2 days 9 hours', NOW() - INTERVAL '2 days 8 hours 40 minutes', 14.1)
    `,
    [vehicleIds[0], vehicleIds[1]]
  );

  console.log('✅ Utilisateur de test créé : admin@gpsauto24.com / password123');
  console.log('✅ 4 véhicules de test ajoutés');
  console.log('✅ 5 alertes de test ajoutées');
  console.log('✅ 5 trajets de test ajoutés');
  process.exit(0);
}

seed();