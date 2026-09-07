const express = require('express');
const pool = require('../config/database');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        name,
        latitude,
        longitude,
        radius,
        created_at
      FROM geofences
      ORDER BY id DESC
      `,
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error(
      'Erreur getGeofences :',
      error.message,
    );

    res.status(500).json({
      message:
        'Impossible de charger les zones géographiques.',
    });
  }
});

router.get('/events', async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        ge.id,
        ge.vehicle_id,
        v.name AS vehicle_name,
        ge.geofence_id,
        g.name AS geofence_name,
        ge.event_type,
        ge.created_at
      FROM geofence_events ge
      JOIN vehicles v
        ON v.id = ge.vehicle_id
      JOIN geofences g
        ON g.id = ge.geofence_id
      ORDER BY ge.created_at DESC
      `,
    );

    res.status(200).json({
      events: result.rows,
    });
  } catch (error) {
    console.error(
      'Erreur getGeofenceEvents :',
      error.message,
    );

    res.status(500).json({
      message:
        'Impossible de charger l’historique des zones.',
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      name,
      latitude,
      longitude,
      radius,
    } = req.body;

    const cleanName =
      name?.toString().trim();

    const parsedLatitude =
      Number(latitude);

    const parsedLongitude =
      Number(longitude);

    const parsedRadius =
      Number(radius);

    if (!cleanName) {
      return res.status(400).json({
        message:
          'Le nom de la zone est obligatoire.',
      });
    }

    if (
      !Number.isFinite(parsedLatitude) ||
      parsedLatitude < -90 ||
      parsedLatitude > 90
    ) {
      return res.status(400).json({
        message:
          'La latitude est invalide.',
      });
    }

    if (
      !Number.isFinite(parsedLongitude) ||
      parsedLongitude < -180 ||
      parsedLongitude > 180
    ) {
      return res.status(400).json({
        message:
          'La longitude est invalide.',
      });
    }

    if (
      !Number.isFinite(parsedRadius) ||
      parsedRadius <= 0
    ) {
      return res.status(400).json({
        message:
          'Le rayon doit être supérieur à 0.',
      });
    }

    const result = await pool.query(
      `
      INSERT INTO geofences (
        name,
        latitude,
        longitude,
        radius
      )
      VALUES (
        $1,
        $2,
        $3,
        $4
      )
      RETURNING
        id,
        name,
        latitude,
        longitude,
        radius,
        created_at
      `,
      [
        cleanName,
        parsedLatitude,
        parsedLongitude,
        parsedRadius,
      ],
    );

    res.status(201).json({
      geofence: result.rows[0],
    });
  } catch (error) {
    console.error(
      'Erreur createGeofence :',
      error.message,
    );

    res.status(500).json({
      message:
        'Impossible de créer la zone géographique.',
    });
  }
});

module.exports = router;