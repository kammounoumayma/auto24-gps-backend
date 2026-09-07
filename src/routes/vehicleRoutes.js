const express = require('express');

const router = express.Router();

const authMiddleware = require(
  '../middlewares/authMiddleware',
);

const {
  getVehicles,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
  getVehiclePositions,
} = require(
  '../controllers/vehicleController',
);

router.use(authMiddleware);

router.get(
  '/vehicles',
  getVehicles,
);

router.get(
  '/vehicles/:id',
  getVehicleById,
);

router.put(
  '/vehicles/:id',
  updateVehicle,
);

router.delete(
  '/vehicles/:id',
  deleteVehicle,
);

router.get(
  '/vehicles/:id/positions',
  getVehiclePositions,
);

module.exports = router;