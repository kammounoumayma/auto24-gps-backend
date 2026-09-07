const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

async function login(req, res) {
  const email =
    req.body.email
      ?.toString()
      .trim()
      .toLowerCase();

  const password =
    req.body.password
      ?.toString();

  if (!email || !password) {
    return res.status(400).json({
      message:
        'Email et mot de passe requis.',
    });
  }

  if (!process.env.JWT_SECRET) {
    console.error(
      'JWT_SECRET manquant dans le fichier .env',
    );

    return res.status(500).json({
      message:
        'Erreur de configuration du serveur.',
    });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        id,
        name,
        email,
        password_hash
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
      `,
      [email],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message:
          'Email ou mot de passe incorrect.',
      });
    }

    const user = result.rows[0];

    const passwordMatches =
      await bcrypt.compare(
        password,
        user.password_hash,
      );

    if (!passwordMatches) {
      return res.status(401).json({
        message:
          'Email ou mot de passe incorrect.',
      });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '7d',
      },
    );

    return res.status(200).json({
      token,
      user: {
        id: user.id.toString(),
        name: user.name ?? '',
        email: user.email,
      },
    });
  } catch (error) {
    console.error(
      'Erreur login :',
      error,
    );

    return res.status(500).json({
      message:
        'Erreur serveur lors de la connexion.',
    });
  }
}

async function getProfile(req, res) {
  const userId = req.userId;

  try {
    const result = await pool.query(
      `
      SELECT
        id,
        name,
        email
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message:
          'Utilisateur introuvable.',
      });
    }

    const user = result.rows[0];

    return res.status(200).json({
      user: {
        id: user.id.toString(),
        name: user.name ?? '',
        email: user.email,
      },
    });
  } catch (error) {
    console.error(
      'Erreur récupération profil :',
      error,
    );

    return res.status(500).json({
      message:
        'Erreur serveur lors de la récupération du profil.',
    });
  }
}

async function updateProfile(req, res) {
  const userId = req.userId;

  const name =
    req.body.name
      ?.toString()
      .trim();

  const email =
    req.body.email
      ?.toString()
      .trim()
      .toLowerCase();

  if (!name || !email) {
    return res.status(400).json({
      message:
        'Nom et email requis.',
    });
  }

  try {
    const existingUser =
      await pool.query(
        `
        SELECT id
        FROM users
        WHERE LOWER(email) = LOWER($1)
          AND id <> $2
        LIMIT 1
        `,
        [
          email,
          userId,
        ],
      );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        message:
          'Cette adresse email est déjà utilisée.',
      });
    }

    const result =
      await pool.query(
        `
        UPDATE users
        SET
          name = $1,
          email = $2
        WHERE id = $3
        RETURNING
          id,
          name,
          email
        `,
        [
          name,
          email,
          userId,
        ],
      );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message:
          'Utilisateur introuvable.',
      });
    }

    const user = result.rows[0];

    return res.status(200).json({
      message:
        'Profil mis à jour.',
      user: {
        id: user.id.toString(),
        name: user.name ?? '',
        email: user.email,
      },
    });
  } catch (error) {
    console.error(
      'Erreur modification profil :',
      error,
    );

    return res.status(500).json({
      message:
        'Erreur serveur lors de la modification du profil.',
    });
  }
}

async function changePassword(req, res) {
  const userId = req.userId;

  const currentPassword =
    req.body.currentPassword
      ?.toString();

  const newPassword =
    req.body.newPassword
      ?.toString();

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      message:
        'Mot de passe actuel et nouveau mot de passe requis.',
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      message:
        'Le nouveau mot de passe doit contenir au moins 6 caractères.',
    });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        id,
        password_hash
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message:
          'Utilisateur introuvable.',
      });
    }

    const user = result.rows[0];

    const passwordMatches =
      await bcrypt.compare(
        currentPassword,
        user.password_hash,
      );

    if (!passwordMatches) {
      return res.status(401).json({
        message:
          'Le mot de passe actuel est incorrect.',
      });
    }

    const samePassword =
      await bcrypt.compare(
        newPassword,
        user.password_hash,
      );

    if (samePassword) {
      return res.status(400).json({
        message:
          'Le nouveau mot de passe doit être différent du mot de passe actuel.',
      });
    }

    const newPasswordHash =
      await bcrypt.hash(
        newPassword,
        12,
      );

    await pool.query(
      `
      UPDATE users
      SET password_hash = $1
      WHERE id = $2
      `,
      [
        newPasswordHash,
        userId,
      ],
    );

    return res.status(200).json({
      message:
        'Mot de passe mis à jour.',
    });
  } catch (error) {
    console.error(
      'Erreur changement mot de passe :',
      error,
    );

    return res.status(500).json({
      message:
        'Erreur serveur lors du changement du mot de passe.',
    });
  }
}

module.exports = {
  login,
  getProfile,
  updateProfile,
  changePassword,
};