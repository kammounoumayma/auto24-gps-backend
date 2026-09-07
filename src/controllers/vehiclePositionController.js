const pool = require('../config/database');

async function getVehiclePositions(req, res) {
  const vehicleId = Number(req.params.id);
  const { date } = req.query;

  if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
    return res.status(400).json({
      message: 'Identifiant du véhicule invalide.',
    });
  }

  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({
      message: 'Format de date invalide. Utilisez YYYY-MM-DD.',
    });
  }

  try {
    const vehicleResult = await pool.query(
      `
      SELECT id
      FROM vehicles
      WHERE id = $1
        AND owner_id = $2
      `,
      [vehicleId, req.userId]
    );

    if (vehicleResult.rows.length === 0) {
      return res.status(404).json({
        message: 'Véhicule introuvable.',
      });
    }

    let query = `
      SELECT
        id,
        vehicle_id,
        latitude,
        longitude,
        speed,
        heading,
        distance,
        recorded_at
      FROM vehicle_positions
      WHERE vehicle_id = $1
    `;

    const values = [vehicleId];

    if (date) {
      query += `
        AND recorded_at >= $2::date
        AND recorded_at < ($2::date + INTERVAL '1 day')
      `;

      values.push(date);
    }

    query += `
      ORDER BY recorded_at ASC
    `;

    const result = await pool.query(
      query,
      values
    );

    return res.status(200).json({
      positions: result.rows.map(formatPosition),
    });
  } catch (error) {
    console.error(
      'Erreur getVehiclePositions :',
      error
    );

    return res.status(500).json({
      message: 'Erreur serveur.',
    });
  }
}

function formatPosition(row) {
  return {
    id: Number(row.id),
    vehicle_id: Number(row.vehicle_id),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    speed:
      row.speed != null
        ? Number(row.speed)
        : 0,
    heading:
      row.heading != null
        ? Number(row.heading)
        : 0,
    distance:
      row.distance != null
        ? Number(row.distance)
        : 0,
    recorded_at: row.recorded_at,
  };
}

module.exports = {
  getVehiclePositions,
};