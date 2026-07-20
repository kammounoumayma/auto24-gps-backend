const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { getVehicles, getVehicleById, updateVehicle } = require('../controllers/vehicleController');

router.get('/vehicles', authMiddleware, getVehicles);
router.get('/vehicles/:id', authMiddleware, getVehicleById);
router.put('/vehicles/:id', authMiddleware, updateVehicle);

module.exports = router;