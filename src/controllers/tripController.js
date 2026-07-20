const pool = require('../config/database');

async function getTrips(req, res) {
  try {
    const result = await pool.query(
      `SELECT t.*, v.name as vehicle_name, v.plate as vehicle_plate
       FROM trips t
       JOIN vehicles v ON t.vehicle_id = v.id
       WHERE v.owner_id = $1
       ORDER BY t.start_time DESC`,
      [req.userId]
    );

    res.json({ trips: result.rows.map(formatTrip) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

function formatTrip(row) {
  return {
    id: row.id.toString(),
    vehicle_id: row.vehicle_id.toString(),
    vehicle_name: row.vehicle_name,
    vehicle_plate: row.vehicle_plate,
    start_location: row.start_location,
    end_location: row.end_location,
    start_time: row.start_time,
    end_time: row.end_time,
    distance_km: row.distance_km ? Number(row.distance_km) : null,
  };
}

module.exports = { getTrips };