const pool = require('../config/database');

async function getAlerts(req, res) {
  try {
    const result = await pool.query(
      `SELECT a.* FROM alerts a
       LEFT JOIN vehicles v ON a.vehicle_id = v.id
       WHERE v.owner_id = $1 OR a.vehicle_id IS NULL
       ORDER BY a.created_at DESC`,
      [req.userId]
    );

    res.json({ alerts: result.rows.map(formatAlert) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
}

function formatAlert(row) {
  return {
    id: row.id.toString(),
    type: row.type,
    severity: row.severity,
    title: row.title,
    description: row.description,
    timestamp: row.created_at,
    vehicle_id: row.vehicle_id ? row.vehicle_id.toString() : null,
  };
}

module.exports = { getAlerts };