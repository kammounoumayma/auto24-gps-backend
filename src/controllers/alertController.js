const pool = require('../config/database');

async function getAlerts(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT
        va.*,
        v.name AS vehicle_name
      FROM vehicle_alerts va
      LEFT JOIN vehicles v
        ON va.vehicle_id = v.id
      WHERE v.owner_id = $1
      ORDER BY va.created_at DESC
      `,
      [req.userId]
    );

    res.status(200).json({
      alerts: result.rows.map(formatAlert),
    });
  } catch (error) {
    console.error(
      'Erreur getAlerts :',
      error.message
    );

    res.status(500).json({
      message: 'Erreur serveur.',
    });
  }
}

function formatAlert(row) {
  return {
    id: row.id.toString(),
    vehicle_id: row.vehicle_id.toString(),
    vehicle_name: row.vehicle_name,
    type: row.type,
    title: row.title,
    message: row.message,
    speed: row.speed
      ? Number(row.speed)
      : null,
    latitude: row.latitude
      ? Number(row.latitude)
      : null,
    longitude: row.longitude
      ? Number(row.longitude)
      : null,
    timestamp: row.created_at,
    is_read: row.is_read,
  };
}
async function markAlertAsRead(req, res) {
  const alertId = Number(req.params.id);

  if (!Number.isInteger(alertId) || alertId <= 0) {
    return res.status(400).json({
      message: 'Identifiant de l’alerte invalide.',
    });
  }

  try {
    const result = await pool.query(
      `
      UPDATE vehicle_alerts AS va
      SET is_read = TRUE
      FROM vehicles AS v
      WHERE va.id = $1
        AND va.vehicle_id = v.id
        AND v.owner_id = $2
      RETURNING va.*
      `,
      [
        alertId,
        req.userId,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Alerte introuvable.',
      });
    }

    return res.status(200).json({
      alert: formatAlert(result.rows[0]),
    });
  } catch (error) {
    console.error(
      'Erreur markAlertAsRead :',
      error.message,
    );

    return res.status(500).json({
      message: 'Erreur serveur.',
    });
  }
}
module.exports = {
  getAlerts,
  markAlertAsRead,
};