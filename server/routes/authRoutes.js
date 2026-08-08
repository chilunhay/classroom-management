const express = require("express");
const router = express.Router();

const { createAccessCode, validateAccessCode, setupAccount } = require("../controllers/authController");

router.post("/createAccessCode", createAccessCode);
router.post("/validateAccessCode", validateAccessCode);
router.post("/setupAccount", setupAccount);

module.exports = router;
