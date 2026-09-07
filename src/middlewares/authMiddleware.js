const jwt = require('jsonwebtoken');

require('dotenv').config({
  override: true,
});

function authMiddleware(req, res, next) {
  const authHeader =
    req.headers.authorization;

  if (
    !authHeader ||
    !authHeader.startsWith('Bearer ')
  ) {
    return res.status(401).json({
      message: 'Token manquant.',
    });
  }

  const token =
    authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      message: 'Token manquant.',
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
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET,
    );

    if (!decoded.userId) {
      return res.status(401).json({
        message:
          'Token utilisateur invalide.',
      });
    }

    req.userId = decoded.userId;

    next();
  } catch (error) {
    if (
      error.name === 'TokenExpiredError'
    ) {
      return res.status(401).json({
        message:
          'Session expirée. Veuillez vous reconnecter.',
      });
    }

    return res.status(401).json({
      message:
        'Token invalide ou expiré.',
    });
  }
}

module.exports = authMiddleware;