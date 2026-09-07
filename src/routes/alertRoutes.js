const express = require('express');
const router = express.Router();

const authMiddleware = require(
  '../middlewares/authMiddleware',
);

const {
  getAlerts,
  markAlertAsRead,
} = require(
  '../controllers/alertController',
);

router.get(
  '/alerts',
  authMiddleware,
  getAlerts,
);

router.put(
  '/alerts/:id/read',
  authMiddleware,
  markAlertAsRead,
);

module.exports = router;