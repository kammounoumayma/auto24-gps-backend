const pool = require('../config/database');

async function getVehicles(req, res) {
  try {
    const result = await pool.query(
      'SELECT * FROM vehicles WHERE owner_id = $1 ORDER BY id',
      [req.userId]
    );
    res.json({ vehicles: result.rows.map(formatVehicle) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function getVehicleById(req, res) {
  try {
    const result = await pool.query(
      'SELECT * FROM vehicles WHERE id = $1 AND owner_id = $2',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Véhicule introuvable.' });
    }

    res.json({ vehicle: formatVehicle(result.rows[0]) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

async function updateVehicle(req, res) {
  const { plate, name, status } = req.body;

  try {
    const result = await pool.query(
      `UPDATE vehicles SET plate = $1, name = $2, status = $3
       WHERE id = $4 AND owner_id = $5 RETURNING *`,
      [plate, name, status, req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Véhicule introuvable.' });
    }

    res.json({ vehicle: formatVehicle(result.rows[0]) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

function formatVehicle(row) {
  return {
    id: row.id.toString(),
    name: row.name,
    plate: row.plate,
    status: row.status,
    last_known_location: row.last_known_location,
    current_speed: row.current_speed ? Number(row.current_speed) : null,
    battery_level: row.battery_level,
    fuel_level: row.fuel_level,
    mileage: row.mileage,
    engine_hours: row.engine_hours ? Number(row.engine_hours) : null,
    next_service_km: row.next_service_km,
    direction: row.direction,
    last_update: row.last_update,
  };
}

module.exports = { getVehicles, getVehicleById, updateVehicle };