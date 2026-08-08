const express = require("express");
const router = express.Router();

const {
  getStudentById,
  getMyLessons,
  markLessonDone,
  editStudentProfile,
  loginUsernamePassword,
  loginEmail,
  validateEmailAccessCode,
} = require("../controllers/studentController");

router.get("/student/profile/:id", getStudentById);
router.get("/myLessons", getMyLessons);
router.post("/markLessonDone", markLessonDone);
router.put("/editProfile", editStudentProfile);
router.post("/loginUsernamePassword", loginUsernamePassword);
router.post("/loginEmail", loginEmail);
router.post("/validateEmailAccessCode", validateEmailAccessCode);

module.exports = router;
