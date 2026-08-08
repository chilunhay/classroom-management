const express = require("express");
const router = express.Router();

const {
  addStudent,
  getStudents,
  getStudentByPhone,
  editStudent,
  deleteStudent,
  assignLesson,
} = require("../controllers/instructorController");

router.post("/addStudent", addStudent);
router.get("/students", getStudents);
router.get("/student/:phone", getStudentByPhone);
router.put("/editStudent/:phone", editStudent);
router.delete("/student/:phone", deleteStudent);
router.post("/assignLesson", assignLesson);

module.exports = router;
