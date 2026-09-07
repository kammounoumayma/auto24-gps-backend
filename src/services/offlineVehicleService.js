const pool = require('../config/database');

const OFFLINE_AFTER_MINUTES = 5;
const CHECK_INTERVAL_MS = 60 * 1000;

async function checkOfflineVehicles() {
  try {
    console.log(
      '🔍 Vérification des véhicules hors ligne...',
    );

    const result = await pool.query(
      `
      SELECT
        id,
        name,
        last_position_at,
        status
      FROM vehicles
      WHERE last_position_at IS NOT NULL
        AND last_position_at <
          NOW() - ($1 * INTERVAL '1 minute')
        AND status <> 'offline'
      `,
      [OFFLINE_AFTER_MINUTES],
    );

    console.log(
      `📊 Véhicules hors ligne trouvés : ${result.rows.length}`,
    );

    for (const vehicle of result.rows) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        await client.query(
          `
          UPDATE vehicles
          SET
            status = 'offline',
            current_speed = 0
          WHERE id = $1
          `,
          [vehicle.id],
        );

        await client.query(
          `
          INSERT INTO vehicle_alerts (
            vehicle_id,
            type,
            title,
            message,
            speed,
            latitude,
            longitude,
            created_at,
            is_read
          )
          VALUES (
            $1,
            'offline',
            'Véhicule hors ligne',
            $2,
            NULL,
            NULL,
            NULL,
            NOW(),
            FALSE
          )
          `,
          [
            vehicle.id,
            `Aucune position GPS reçue depuis plus de ${OFFLINE_AFTER_MINUTES} minute(s).`,
          ],
        );

        await client.query('COMMIT');

        console.log(
          `⚠️ Véhicule ${vehicle.id} (${vehicle.name}) passé hors ligne`,
        );
      } catch (error) {
        await client.query('ROLLBACK');

        console.error(
          `❌ Erreur de mise hors ligne du véhicule ${vehicle.id}`,
        );

        console.error(
          'Message :',
          error?.message,
        );

        console.error(
          'Code PostgreSQL :',
          error?.code,
        );

        console.error(
          'Détail :',
          error?.detail,
        );

        console.error(
          'Erreur complète :',
          error,
        );
      } finally {
        client.release();
      }
    }
  } catch (error) {
    console.error(
      '❌ Erreur lors de la vérification des véhicules hors ligne',
    );

    console.error(
      'Message :',
      error?.message,
    );

    console.error(
      'Code PostgreSQL :',
      error?.code,
    );

    console.error(
      'Détail :',
      error?.detail,
    );

    console.error(
      'Table :',
      error?.table,
    );

    console.error(
      'Colonne :',
      error?.column,
    );

    console.error(
      'Erreur complète :',
      error,
    );
  }
}

function startOfflineVehicleWatcher() {
  console.log(
    `⏱️ Surveillance hors ligne démarrée : ${OFFLINE_AFTER_MINUTES} minute(s)`,
  );

  void checkOfflineVehicles();

  return setInterval(
    () => {
      void checkOfflineVehicles();
    },
    CHECK_INTERVAL_MS,
  );
}

module.exports = {
  checkOfflineVehicles,
  startOfflineVehicleWatcher,
};