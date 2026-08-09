const express = require("express");
const router = express.Router();

const {
  getStudentById,
  getMyLessons,
  markLessonDone,
  editStudentProfile,
} = require("../controllers/studentController");

router.get("/student/profile/:id", getStudentById);
router.get("/myLessons", getMyLessons);
router.post("/markLessonDone", markLessonDone);
router.put("/editProfile", editStudentProfile);

module.exports = router;
