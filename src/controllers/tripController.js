const pool = require('../config/database');

/**
 * Retourne l'historique des trajets.
 *
 * Un trajet correspond actuellement à une journée
 * d'activité GPS d'un véhicule.
 *
 * Les données sont calculées directement depuis
 * vehicle_positions.
 */
async function getTrips(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT
        v.id AS vehicle_id,
        v.name AS vehicle_name,
        v.plate AS vehicle_plate,

        vp.recorded_at::date AS trip_date,

        MIN(vp.recorded_at) AS start_time,
        MAX(vp.recorded_at) AS end_time,

        GREATEST(
          COALESCE(MAX(vp.distance), 0)
          - COALESCE(MIN(vp.distance), 0),
          0
        ) AS distance_km,

        COUNT(vp.id) AS total_positions

      FROM vehicles v

      INNER JOIN vehicle_positions vp
        ON vp.vehicle_id = v.id

      WHERE
        v.owner_id = $1

      GROUP BY
        v.id,
        v.name,
        v.plate,
        vp.recorded_at::date

      HAVING COUNT(vp.id) >= 2

      ORDER BY
        MAX(vp.recorded_at) DESC
      `,
      [req.userId],
    );

    const trips = result.rows.map((row) => {
      let tripDate;

      if (row.trip_date instanceof Date) {
        tripDate =
          row.trip_date.toISOString().split('T')[0];
      } else {
        tripDate =
          String(row.trip_date).split('T')[0];
      }

      return {
        id: `${row.vehicle_id}-${tripDate}`,

        vehicle_id:
          row.vehicle_id.toString(),

        vehicle_name:
          row.vehicle_name,

        vehicle_plate:
          row.vehicle_plate,

        start_location:
          null,

        end_location:
          null,

        start_time:
          row.start_time,

        end_time:
          row.end_time,

        distance_km:
          Number(
            Number(
              row.distance_km || 0,
            ).toFixed(2),
          ),

        total_positions:
          Number(
            row.total_positions || 0,
          ),
      };
    });

    return res.status(200).json({
      trips,
    });
  } catch (error) {
    console.error(
      '❌ Erreur récupération trajets :',
      error,
    );

    return res.status(500).json({
      message:
        'Erreur lors de la récupération des trajets.',
      error:
        error.message,
    });
  }
}

module.exports = {
  getTrips,
};