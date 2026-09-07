const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

require('dotenv').config({
  override: true,
});

const GEOFENCE_EXIT_MARGIN_METERS = 30;

function setupTrackingSocket(server) {
  const wss = new WebSocket.Server({
    server,
    path: '/ws/tracking',
  });

  wss.on('connection', (ws, req) => {
    console.log(
      '🔌 Client connecté au tracking WebSocket',
    );

    const url = new URL(
      req.url,
      `http://${req.headers.host}`,
    );

    const token =
      url.searchParams.get('token');

    const vehicleIdParam =
      url.searchParams.get('vehicleId');

    if (!token) {
      sendError(
        ws,
        'Token d’authentification manquant.',
      );

      ws.close(
        1008,
        'Token manquant',
      );

      return;
    }

    if (!vehicleIdParam) {
      sendError(
        ws,
        'Identifiant du véhicule manquant.',
      );

      ws.close(
        1008,
        'Identifiant du véhicule manquant',
      );

      return;
    }

    const vehicleId =
      Number(vehicleIdParam);

    if (
      !Number.isInteger(vehicleId) ||
      vehicleId <= 0
    ) {
      sendError(
        ws,
        'Identifiant du véhicule invalide.',
      );

      ws.close(
        1008,
        'Identifiant du véhicule invalide',
      );

      return;
    }

    try {
      jwt.verify(
        token,
        process.env.JWT_SECRET,
      );
    } catch (error) {
      console.error(
        '❌ Token WebSocket invalide :',
        error.message,
      );

      sendError(
        ws,
        'Token invalide ou expiré.',
      );

      ws.close(
        1008,
        'Token invalide',
      );

      return;
    }

    let currentLat = null;
    let currentLng = null;
    let currentSpeed = 0;
    let totalDistance = 0;

    let lastSpeedAlertAt = null;

    const speedLimit = 80;
const alertCooldownMs = 5 * 60 * 1000;

    /*
     * Trajet simulé autour de Monastir.
     *
     * Le véhicule parcourt les points
     * successivement puis revient dans
     * le sens inverse.
     */
    const route = [
      {
        lat: 35.764300,
        lng: 10.811300,
      },
      {
        lat: 35.764430,
        lng: 10.811720,
      },
      {
        lat: 35.764570,
        lng: 10.812150,
      },
      {
        lat: 35.764720,
        lng: 10.812580,
      },
      {
        lat: 35.764880,
        lng: 10.813010,
      },
      {
        lat: 35.765030,
        lng: 10.813450,
      },
      {
        lat: 35.765190,
        lng: 10.813890,
      },
      {
        lat: 35.765350,
        lng: 10.814330,
      },
      {
        lat: 35.765510,
        lng: 10.814770,
      },
      {
        lat: 35.765680,
        lng: 10.815210,
      },
      {
        lat: 35.765850,
        lng: 10.815650,
      },
      {
        lat: 35.766020,
        lng: 10.816090,
      },
    ];

    let routeIndex = 0;
    let routeDirection = 1;

    ws.send(
      JSON.stringify({
        type: 'connected',
        message:
          'Connexion au suivi GPS établie.',
        vehicleId,
      }),
    );

    /*
     * Enregistrement de la position
     * dans PostgreSQL.
     */
    const savePosition =
      async (position) => {
        try {
          await pool.query(
            `
              INSERT INTO vehicle_positions (
                vehicle_id,
                latitude,
                longitude,
                speed,
                heading,
                distance,
                recorded_at
              )
              VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7
              )
            `,
            [
              position.vehicleId,
              position.lat,
              position.lng,
              position.speed,
              position.heading,
              position.distance,
              position.timestamp,
            ],
          );

          await pool.query(
            `
              UPDATE vehicles
              SET
                last_position_at = $1,
                last_update = $1,
                current_speed = $2,
                status = 'online'
              WHERE id = $3
            `,
            [
              position.timestamp,
              position.speed,
              position.vehicleId,
            ],
          );

          console.log(
            `🚗 Véhicule ${position.vehicleId} mis à jour : ${position.speed} km/h`,
          );

          console.log(
            `💾 Position enregistrée pour le véhicule ${position.vehicleId}`,
          );

          await detectGeofence({
            ws,
            vehicleId:
              position.vehicleId,
            latitude:
              position.lat,
            longitude:
              position.lng,
          });

          /*
           * Vérification de la vitesse.
           */
          const now =
            Date.now();

          const canCreateAlert =
            lastSpeedAlertAt === null ||
            now -
                lastSpeedAlertAt >=
              alertCooldownMs;

          if (
            position.speed >
              speedLimit &&
            canCreateAlert
          ) {
            const alertResult =
              await pool.query(
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
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    FALSE
                  )
                  RETURNING *
                `,
                [
                  position.vehicleId,
                  'speed',
                  'Alerte de vitesse',
                  `Vitesse dépassée : ${position.speed} km/h`,
                  position.speed,
                  position.lat,
                  position.lng,
                  position.timestamp,
                ],
              );

            const alert =
              alertResult.rows[0];

            lastSpeedAlertAt =
              now;

            console.log(
              `🚨 Alerte créée pour le véhicule ${position.vehicleId} : ${position.speed} km/h`,
            );

            sendAlert(
              ws,
              alert,
            );
          }
        } catch (error) {
          console.error(
            `❌ Erreur d’enregistrement GPS pour le véhicule ${position.vehicleId} :`,
            error.message,
          );
        }
      };

    /*
     * Chargement de la dernière
     * position enregistrée.
     */
    const loadInitialPosition =
      async () => {
        try {
          const result =
            await pool.query(
              `
                SELECT
                  latitude,
                  longitude,
                  speed,
                  distance
                FROM vehicle_positions
                WHERE vehicle_id = $1
                ORDER BY recorded_at DESC
                LIMIT 1
              `,
              [
                vehicleId,
              ],
            );

          if (
            result.rows.length >
            0
          ) {
            const lastPosition =
              result.rows[0];

            currentLat =
              Number(
                lastPosition.latitude,
              );

            currentLng =
              Number(
                lastPosition.longitude,
              );

            currentSpeed =
              Number(
                lastPosition.speed ??
                  0,
              );

            totalDistance =
              Number(
                lastPosition.distance ??
                  0,
              );

            console.log(
              `📍 Position initiale chargée pour le véhicule ${vehicleId} :`,
              {
                latitude:
                  currentLat,
                longitude:
                  currentLng,
                distance:
                  totalDistance,
              },
            );

            /*
             * Recherche du point du trajet
             * le plus proche de la position
             * enregistrée.
             */
            routeIndex =
              findNearestRouteIndex(
                currentLat,
                currentLng,
                route,
              );

            /*
             * On avance ensuite vers
             * le point suivant.
             */
            if (
              routeIndex <
              route.length - 1
            ) {
              routeIndex += 1;
            }

            return;
          }

          /*
           * Position par défaut.
           */
          currentLat =
            route[0].lat;

          currentLng =
            route[0].lng;

          currentSpeed = 0;
          totalDistance = 0;

          routeIndex = 1;

          console.log(
            `📍 Aucune position trouvée pour le véhicule ${vehicleId}, position Monastir utilisée.`,
          );
        } catch (error) {
          console.error(
            `❌ Impossible de charger la position initiale du véhicule ${vehicleId} :`,
            error.message,
          );

          currentLat =
            route[0].lat;

          currentLng =
            route[0].lng;

          currentSpeed = 0;
          totalDistance = 0;

          routeIndex = 1;
        }
      };

    /*
     * Envoi d'une position GPS.
     */
    const sendPosition =
      async () => {
        if (
          ws.readyState !==
          WebSocket.OPEN
        ) {
          return;
        }

        if (
          currentLat == null ||
          currentLng == null
        ) {
          return;
        }

        const target =
          route[routeIndex];

        const previousLat =
          currentLat;

        const previousLng =
          currentLng;

        currentLat =
          target.lat;

        currentLng =
          target.lng;

        /*
         * Vitesse simulée entre
         * 45 et 90 km/h.
         */
       currentSpeed =
  45 + Math.random() * 45;

        /*
         * Distance réelle entre
         * les deux points GPS.
         */
        const segmentDistanceMeters =
          calculateDistance(
            previousLat,
            previousLng,
            currentLat,
            currentLng,
          );

        totalDistance +=
          segmentDistanceMeters /
          1000;

        /*
         * Direction réelle du
         * déplacement.
         */
        const heading =
          calculateHeading(
            previousLat,
            previousLng,
            currentLat,
            currentLng,
          );

        const position = {
          type:
            'vehicle_position',

          vehicleId,

          lat: Number(
            currentLat.toFixed(
              6,
            ),
          ),

          lng: Number(
            currentLng.toFixed(
              6,
            ),
          ),

          speed: Number(
            currentSpeed.toFixed(
              1,
            ),
          ),

          distance: Number(
            totalDistance.toFixed(
              2,
            ),
          ),

          heading: Number(
            heading.toFixed(
              0,
            ),
          ),

          timestamp:
            new Date().toISOString(),
        };

        ws.send(
          JSON.stringify(
            position,
          ),
        );

        console.log(
          `📍 Position envoyée au véhicule ${vehicleId} :`,
          position,
        );

        await savePosition(
          position,
        );

        /*
         * Avancement dans le trajet.
         *
         * Une fois arrivé au dernier
         * point, le véhicule repart
         * dans le sens inverse.
         */
        routeIndex +=
          routeDirection;

        if (
          routeIndex >=
          route.length
        ) {
          routeDirection = -1;

          routeIndex =
            route.length - 2;
        }

        if (
          routeIndex < 0
        ) {
          routeDirection = 1;

          routeIndex = 1;
        }
      };

    /*
     * On charge d'abord la position
     * avant de commencer le suivi.
     */
    void loadInitialPosition()
      .then(() => {
        void sendPosition();
      });

    /*
     * Nouvelle position toutes
     * les 3 secondes.
     */
    const interval =
      setInterval(
        () => {
          void sendPosition();
        },
        3000,
      );

    ws.on(
      'error',
      (error) => {
        console.error(
          `❌ Erreur WebSocket véhicule ${vehicleId} :`,
          error.message,
        );
      },
    );

    ws.on(
      'close',
      (code, reason) => {
        clearInterval(
          interval,
        );

        console.log(
          `🔌 Client déconnecté du véhicule ${vehicleId}`,
          {
            code,
            reason:
              reason.toString(),
          },
        );
      },
    );
  });

  wss.on(
    'error',
    (error) => {
      console.error(
        '❌ Erreur du serveur WebSocket :',
        error.message,
      );
    },
  );

  console.log(
    '📡 WebSocket tracking prêt sur /ws/tracking',
  );
}

/*
 * Recherche du point du trajet
 * le plus proche du véhicule.
 */
function findNearestRouteIndex(
  latitude,
  longitude,
  route,
) {
  let nearestIndex = 0;
  let nearestDistance =
    Infinity;

  for (
    let index = 0;
    index < route.length;
    index += 1
  ) {
    const point =
      route[index];

    const distance =
      calculateDistance(
        latitude,
        longitude,
        point.lat,
        point.lng,
      );

    if (
      distance <
      nearestDistance
    ) {
      nearestDistance =
        distance;

      nearestIndex =
        index;
    }
  }

  return nearestIndex;
}

/*
 * Détection des géofences.
 */
async function detectGeofence({
  ws,
  vehicleId,
  latitude,
  longitude,
}) {
  try {
    const vehicleResult =
      await pool.query(
        `
          SELECT
            id,
            name,
            current_geofence_id
          FROM vehicles
          WHERE id = $1
        `,
        [
          vehicleId,
        ],
      );

    if (
      vehicleResult.rows.length ===
      0
    ) {
      console.log(
        `⚠️ Véhicule ${vehicleId} introuvable`,
      );

      return;
    }

    const vehicle =
      vehicleResult.rows[0];

    const zonesResult =
      await pool.query(
        `
          SELECT
            id,
            name,
            latitude,
            longitude,
            radius
          FROM geofences
          ORDER BY id
        `,
      );

    let detectedZone =
      null;

    const previousZoneId =
      vehicle.current_geofence_id ==
      null
        ? null
        : Number(
            vehicle.current_geofence_id,
          );

    for (
      const zone of
      zonesResult.rows
    ) {
      const zoneLatitude =
        Number(
          zone.latitude,
        );

      const zoneLongitude =
        Number(
          zone.longitude,
        );

      const zoneRadius =
        Number(
          zone.radius,
        );

      if (
        !Number.isFinite(
          zoneLatitude,
        ) ||
        !Number.isFinite(
          zoneLongitude,
        ) ||
        !Number.isFinite(
          zoneRadius,
        )
      ) {
        continue;
      }

      const distance =
        calculateDistance(
          latitude,
          longitude,
          zoneLatitude,
          zoneLongitude,
        );

      console.log(
        `📏 Véhicule ${vehicleId} → ${zone.name} : ${Math.round(distance)} m`,
      );

      if (
        previousZoneId ===
        Number(
          zone.id,
        )
      ) {
        if (
          distance <=
          zoneRadius +
            GEOFENCE_EXIT_MARGIN_METERS
        ) {
          detectedZone =
            zone;

          break;
        }
      } else if (
        distance <=
        zoneRadius
      ) {
        detectedZone =
          zone;

        break;
      }
    }

    const newZoneId =
      detectedZone ==
      null
        ? null
        : Number(
            detectedZone.id,
          );

    /*
     * Aucun changement.
     */
    if (
      previousZoneId ===
      newZoneId
    ) {
      return;
    }

    /*
     * Sortie d'une zone.
     */
    if (
      previousZoneId !=
        null &&
      previousZoneId !==
        newZoneId
    ) {
      const previousZoneResult =
        await pool.query(
          `
            SELECT
              id,
              name
            FROM geofences
            WHERE id = $1
          `,
          [
            previousZoneId,
          ],
        );

      const previousZone =
        previousZoneResult
          .rows[0];

      if (
        previousZone != null
      ) {
        await pool.query(
          `
            INSERT INTO geofence_events (
              vehicle_id,
              geofence_id,
              event_type,
              created_at
            )
            VALUES (
              $1,
              $2,
              'exit',
              NOW()
            )
          `,
          [
            vehicleId,
            previousZoneId,
          ],
        );

        const exitAlertResult =
          await pool.query(
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
                'geofence_exit',
                'Sortie de zone',
                $2,
                NULL,
                $3,
                $4,
                NOW(),
                FALSE
              )
              RETURNING *
            `,
            [
              vehicleId,
              `${vehicle.name} a quitté la zone ${previousZone.name}.`,
              latitude,
              longitude,
            ],
          );

        console.log(
          `🚪 Véhicule ${vehicleId} sorti de ${previousZone.name}`,
        );

        sendAlert(
          ws,
          exitAlertResult
            .rows[0],
        );
      }
    }

    /*
     * Entrée dans une zone.
     */
    if (
      newZoneId != null
    ) {
      await pool.query(
        `
          INSERT INTO geofence_events (
            vehicle_id,
            geofence_id,
            event_type,
            created_at
          )
          VALUES (
            $1,
            $2,
            'enter',
            NOW()
          )
        `,
        [
          vehicleId,
          newZoneId,
        ],
      );

      const enterAlertResult =
        await pool.query(
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
              'geofence_enter',
              'Entrée dans une zone',
              $2,
              NULL,
              $3,
              $4,
              NOW(),
              FALSE
            )
            RETURNING *
          `,
          [
            vehicleId,
            `${vehicle.name} est entré dans la zone ${detectedZone.name}.`,
            latitude,
            longitude,
          ],
        );

      console.log(
        `🚪 Véhicule ${vehicleId} entré dans ${detectedZone.name}`,
      );

      sendAlert(
        ws,
        enterAlertResult
          .rows[0],
      );
    }

    /*
     * Mise à jour de la zone
     * actuelle du véhicule.
     */
    await pool.query(
      `
        UPDATE vehicles
        SET current_geofence_id = $1
        WHERE id = $2
      `,
      [
        newZoneId,
        vehicleId,
      ],
    );

    console.log(
      `📍 Zone actuelle du véhicule ${vehicleId} : ${
        detectedZone
          ? detectedZone.name
          : 'aucune'
      }`,
    );
  } catch (error) {
    console.error(
      '❌ Erreur de détection géofencing :',
      error.message,
    );
  }
}

/*
 * Calcul de la distance GPS
 * entre deux coordonnées.
 */
function calculateDistance(
  latitude1,
  longitude1,
  latitude2,
  longitude2,
) {
  const earthRadiusInMeters =
    6371000;

  const latitudeDifference =
    degreesToRadians(
      latitude2 -
        latitude1,
    );

  const longitudeDifference =
    degreesToRadians(
      longitude2 -
        longitude1,
    );

  const latitude1InRadians =
    degreesToRadians(
      latitude1,
    );

  const latitude2InRadians =
    degreesToRadians(
      latitude2,
    );

  const haversineValue =
    Math.sin(
      latitudeDifference /
        2,
    ) **
      2 +
    Math.cos(
      latitude1InRadians,
    ) *
      Math.cos(
        latitude2InRadians,
      ) *
      Math.sin(
        longitudeDifference /
          2,
      ) **
        2;

  const angularDistance =
    2 *
    Math.atan2(
      Math.sqrt(
        haversineValue,
      ),
      Math.sqrt(
        1 -
          haversineValue,
      ),
    );

  return (
    earthRadiusInMeters *
    angularDistance
  );
}

/*
 * Calcul de la direction
 * réelle entre deux points.
 *
 * 0   = Nord
 * 90  = Est
 * 180 = Sud
 * 270 = Ouest
 */
function calculateHeading(
  latitude1,
  longitude1,
  latitude2,
  longitude2,
) {
  const latitude1Rad =
    degreesToRadians(
      latitude1,
    );

  const latitude2Rad =
    degreesToRadians(
      latitude2,
    );

  const longitudeDifference =
    degreesToRadians(
      longitude2 -
        longitude1,
    );

  const y =
    Math.sin(
      longitudeDifference,
    ) *
    Math.cos(
      latitude2Rad,
    );

  const x =
    Math.cos(
      latitude1Rad,
    ) *
      Math.sin(
        latitude2Rad,
      ) -
    Math.sin(
      latitude1Rad,
    ) *
      Math.cos(
        latitude2Rad,
      ) *
      Math.cos(
        longitudeDifference,
      );

  const heading =
    Math.atan2(
      y,
      x,
    ) *
    180 /
    Math.PI;

  return (
    heading + 360
  ) % 360;
}

function degreesToRadians(
  degrees,
) {
  return (
    degrees *
    Math.PI /
    180
  );
}

/*
 * Envoi d'une alerte vers
 * Flutter via WebSocket.
 */
function sendAlert(
  ws,
  alert,
) {
  if (
    ws.readyState !==
    WebSocket.OPEN
  ) {
    return;
  }

  ws.send(
    JSON.stringify({
      type:
        'vehicle_alert',

      alert: {
        id:
          alert.id,

        vehicleId:
          alert.vehicle_id,

        alertType:
          alert.type,

        title:
          alert.title,

        message:
          alert.message,

        speed:
          alert.speed != null
            ? Number(
                alert.speed,
              )
            : null,

        latitude:
          alert.latitude !=
          null
            ? Number(
                alert.latitude,
              )
            : null,

        longitude:
          alert.longitude !=
          null
            ? Number(
                alert.longitude,
              )
            : null,

        createdAt:
          alert.created_at,

        isRead:
          alert.is_read,
      },
    }),
  );
}

/*
 * Envoi d'une erreur
 * vers Flutter.
 */
function sendError(
  ws,
  message,
) {
  if (
    ws.readyState !==
    WebSocket.OPEN
  ) {
    return;
  }

  ws.send(
    JSON.stringify({
      type: 'error',
      message,
    }),
  );
}

module.exports =
  setupTrackingSocket;