const { Pool } = require('pg');

require('dotenv').config();

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL,
});

pool.query(
  `
  SELECT
    current_database() AS database_name,
    current_user AS database_user
  `,
)
  .then((result) => {
    console.log(
      '📦 Base utilisée par Node.js :',
      result.rows[0],
    );
  })
  .catch((error) => {
    console.error(
      '❌ Impossible de vérifier la base :',
      error.message,
    );
  });

pool.on('connect', () => {
  console.log(
    '✅ Connecté à PostgreSQL',
  );
});

pool.on('error', (error) => {
  console.error(
    '❌ Erreur PostgreSQL :',
    error.message,
  );
});

module.exports = pool;