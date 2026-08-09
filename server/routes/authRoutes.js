const express = require("express");
const router = express.Router();

const {
  createAccessCode,
  validateAccessCode,
  setupAccount,
  loginUsernamePassword,
  loginEmail,
  validateEmailAccessCode,
} = require("../controllers/authController");

// Phone authentication
router.post("/createAccessCode", createAccessCode);
router.post("/validateAccessCode", validateAccessCode);

// Username + password
router.post("/loginUsernamePassword", loginUsernamePassword);

// Email authentication
router.post("/loginEmail", loginEmail);
router.post("/validateEmailAccessCode", validateEmailAccessCode);

// Student account setup
router.post("/setupAccount", setupAccount);

module.exports = router;
