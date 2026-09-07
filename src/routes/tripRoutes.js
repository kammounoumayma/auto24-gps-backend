const express = require('express');

const router = express.Router();

const authMiddleware = require('../middlewares/authMiddleware');

const {
  getTrips,
} = require('../controllers/tripController');

router.get(
  '/trips',
  authMiddleware,
  getTrips,
);

module.exports = router;