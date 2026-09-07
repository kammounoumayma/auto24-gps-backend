const pool = require('../config/database');

function parseVehicleId(value) {
  const vehicleId = Number(value);

  if (
    !Number.isInteger(vehicleId) ||
    vehicleId <= 0
  ) {
    return null;
  }

  return vehicleId;
}

function formatVehicle(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id?.toString() ?? '',
    name: row.name ?? 'Véhicule',
    plate: row.plate ?? '',
    status: row.status ?? 'unknown',

    last_known_location:
      row.last_known_location ?? null,

    latitude:
      row.latitude !== null &&
      row.latitude !== undefined
        ? Number(row.latitude)
        : null,

    longitude:
      row.longitude !== null &&
      row.longitude !== undefined
        ? Number(row.longitude)
        : null,

    current_speed:
      row.current_speed !== null &&
      row.current_speed !== undefined
        ? Number(row.current_speed)
        : 0,

    battery_level:
      row.battery_level !== null &&
      row.battery_level !== undefined
        ? Number(row.battery_level)
        : null,

    fuel_level:
      row.fuel_level !== null &&
      row.fuel_level !== undefined
        ? Number(row.fuel_level)
        : null,

    mileage:
      row.mileage !== null &&
      row.mileage !== undefined
        ? Number(row.mileage)
        : null,

    engine_hours:
      row.engine_hours !== null &&
      row.engine_hours !== undefined
        ? Number(row.engine_hours)
        : null,

    next_service_km:
      row.next_service_km !== null &&
      row.next_service_km !== undefined
        ? Number(row.next_service_km)
        : null,

    heading:
      row.heading !== null &&
      row.heading !== undefined
        ? Number(row.heading)
        : null,

    last_update:
      row.last_update ?? null,
  };
}

const vehicleSelectQuery = `
  SELECT
    v.id,
    v.name,
    v.plate,
    v.status,
    v.last_known_location,
    v.battery_level,
    v.fuel_level,
    v.mileage,
    v.engine_hours,
    v.next_service_km,

    latest_position.latitude,
    latest_position.longitude,

    COALESCE(
      latest_position.speed,
      v.current_speed,
      0
    ) AS current_speed,

    latest_position.heading,

    COALESCE(
      latest_position.recorded_at,
      v.last_position_at,
      v.last_update
    ) AS last_update

  FROM vehicles v

  LEFT JOIN LATERAL (
    SELECT
      vp.latitude,
      vp.longitude,
      vp.speed,
      vp.heading,
      vp.recorded_at
    FROM vehicle_positions vp
    WHERE vp.vehicle_id = v.id
    ORDER BY vp.recorded_at DESC
    LIMIT 1
  ) latest_position
    ON TRUE
`;

exports.getVehicles = async (
  req,
  res,
) => {
  try {
    const result = await pool.query(
      `
      ${vehicleSelectQuery}

      WHERE
        v.deleted_at IS NULL

      ORDER BY
        v.id ASC
      `,
    );

    const vehicles =
      result.rows.map(formatVehicle);

    return res.status(200).json({
      vehicles,
    });
  } catch (error) {
    console.error(
      '❌ Erreur getVehicles :',
      error,
    );

    return res.status(500).json({
      message:
        'Impossible de récupérer les véhicules.',
    });
  }
};

exports.getVehicleById = async (
  req,
  res,
) => {
  try {
    const vehicleId =
      parseVehicleId(req.params.id);

    if (!vehicleId) {
      return res.status(400).json({
        message:
          'Identifiant du véhicule invalide.',
      });
    }

    const result = await pool.query(
      `
      ${vehicleSelectQuery}

      WHERE
        v.id = $1
        AND v.deleted_at IS NULL

      LIMIT 1
      `,
      [vehicleId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message:
          'Véhicule introuvable.',
      });
    }

    return res.status(200).json({
      vehicle: formatVehicle(
        result.rows[0],
      ),
    });
  } catch (error) {
    console.error(
      '❌ Erreur getVehicleById :',
      error,
    );

    return res.status(500).json({
      message:
        'Impossible de récupérer le véhicule.',
    });
  }
};

exports.updateVehicle = async (
  req,
  res,
) => {
  try {
    const vehicleId =
      parseVehicleId(req.params.id);

    if (!vehicleId) {
      return res.status(400).json({
        message:
          'Identifiant du véhicule invalide.',
      });
    }

    const {
      name,
      plate,
      status,
    } = req.body;

    if (
      !name ||
      !name.toString().trim() ||
      !plate ||
      !plate.toString().trim()
    ) {
      return res.status(400).json({
        message:
          'Le nom et l’immatriculation sont obligatoires.',
      });
    }

    const existingVehicle =
      await pool.query(
        `
        SELECT id
        FROM vehicles
        WHERE
          id = $1
          AND deleted_at IS NULL
        LIMIT 1
        `,
        [vehicleId],
      );

    if (
      existingVehicle.rows.length === 0
    ) {
      return res.status(404).json({
        message:
          'Véhicule introuvable.',
      });
    }

    await pool.query(
      `
      UPDATE vehicles
      SET
        name = $1,
        plate = $2,
        status = $3,
        last_update = NOW()
      WHERE
        id = $4
        AND deleted_at IS NULL
      `,
      [
        name.toString().trim(),
        plate.toString().trim(),
        status
          ? status
              .toString()
              .trim()
              .toLowerCase()
          : 'unknown',
        vehicleId,
      ],
    );

    const result = await pool.query(
      `
      ${vehicleSelectQuery}

      WHERE
        v.id = $1
        AND v.deleted_at IS NULL

      LIMIT 1
      `,
      [vehicleId],
    );

    return res.status(200).json({
      message:
        'Véhicule modifié avec succès.',
      vehicle: formatVehicle(
        result.rows[0],
      ),
    });
  } catch (error) {
    console.error(
      '❌ Erreur updateVehicle :',
      error,
    );

    if (
      error.code === '23505'
    ) {
      return res.status(409).json({
        message:
          'Un véhicule avec cette immatriculation existe déjà.',
      });
    }

    return res.status(500).json({
      message:
        'Impossible de modifier le véhicule.',
    });
  }
};

exports.deleteVehicle = async (
  req,
  res,
) => {
  try {
    const vehicleId =
      parseVehicleId(req.params.id);

    if (!vehicleId) {
      return res.status(400).json({
        message:
          'Identifiant du véhicule invalide.',
      });
    }

    const result = await pool.query(
      `
      UPDATE vehicles
      SET
        deleted_at = NOW(),
        status = 'offline',
        last_update = NOW()
      WHERE
        id = $1
        AND deleted_at IS NULL
      RETURNING id
      `,
      [vehicleId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message:
          'Véhicule introuvable.',
      });
    }

    return res.status(200).json({
      message:
        'Véhicule supprimé avec succès.',
    });
  } catch (error) {
    console.error(
      '❌ Erreur deleteVehicle :',
      error,
    );

    return res.status(500).json({
      message:
        'Impossible de supprimer le véhicule.',
    });
  }
};

exports.getVehiclePositions = async (
  req,
  res,
) => {
  try {
    const vehicleId =
      parseVehicleId(req.params.id);

    if (!vehicleId) {
      return res.status(400).json({
        message:
          'Identifiant du véhicule invalide.',
      });
    }

    const vehicleResult =
      await pool.query(
        `
        SELECT id
        FROM vehicles
        WHERE
          id = $1
          AND deleted_at IS NULL
        LIMIT 1
        `,
        [vehicleId],
      );

    if (
      vehicleResult.rows.length === 0
    ) {
      return res.status(404).json({
        message:
          'Véhicule introuvable.',
      });
    }

    const queryValues = [
      vehicleId,
    ];

    let dateCondition = '';

    if (req.query.date) {
      queryValues.push(
        req.query.date,
      );

      dateCondition = `
        AND vp.recorded_at::date = $2::date
      `;
    }

    const positionsResult =
      await pool.query(
        `
        SELECT
          vp.id,
          vp.vehicle_id,
          vp.latitude,
          vp.longitude,
          vp.speed,
          vp.heading,
          vp.distance,
          vp.recorded_at

        FROM vehicle_positions vp

        WHERE
          vp.vehicle_id = $1
          ${dateCondition}

        ORDER BY
          vp.recorded_at ASC
        `,
        queryValues,
      );

    const positions =
      positionsResult.rows.map(
        (position) => ({
          id:
            position.id?.toString() ??
            '',
          vehicle_id:
            position.vehicle_id
              ?.toString() ??
            '',
          latitude:
            Number(
              position.latitude,
            ),
          longitude:
            Number(
              position.longitude,
            ),
          speed:
            position.speed !== null
              ? Number(
                  position.speed,
                )
              : 0,
          heading:
            position.heading !== null
              ? Number(
                  position.heading,
                )
              : null,
          distance:
            position.distance !== null
              ? Number(
                  position.distance,
                )
              : null,
          recorded_at:
            position.recorded_at,
        }),
      );

    return res.status(200).json({
      positions,
    });
  } catch (error) {
    console.error(
      '❌ Erreur getVehiclePositions :',
      error,
    );

    return res.status(500).json({
      message:
        'Impossible de récupérer l’historique GPS.',
    });
  }
};