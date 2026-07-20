const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { getAlerts } = require('../controllers/alertController');

router.get('/alerts', authMiddleware, getAlerts);

module.exports = router;