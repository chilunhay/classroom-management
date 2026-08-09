const firestoreDB = require("../firebaseInit");

const getStudentById = async (req, res) => {
  const { id } = req.params;

  try {
    const studentDoc = await firestoreDB.collection("students").doc(id).get();

    if (!studentDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "Student not found",
      });
    }

    return res.status(200).json({
      success: true,
      student: {
        id: studentDoc.id,
        ...studentDoc.data(),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Lấy tất cả khóa học đã được giao
const getMyLessons = async (req, res) => {
  const phone = req.query.phone;

  if (!phone) {
    return res.status(400).json({ success: false, error: "Phone number is required" });
  }

  try {
    const lessons = [];
    const lessonsRef = firestoreDB.collection("lessons");
    const lessonsQuery = lessonsRef.where("studentPhone", "==", phone);
    const lessonsSnapshot = await lessonsQuery.get();
    lessonsSnapshot.forEach((doc) => {
      lessons.push({ id: doc.id, ...doc.data() });
    });
    res.status(200).json({ success: true, lessons });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Hoàn thành khóa học
const markLessonDone = async (req, res) => {
  const { phone, lessonId } = req.body;

  if (!phone || !lessonId) {
    return res.status(400).json({
      success: false,
      error: "Phone number and lessonId are required",
    });
  }

  try {
    const lessonDocRef = firestoreDB.collection("lessons").doc(lessonId);
    const lessonDoc = await lessonDocRef.get();
    if (!lessonDoc.exists) {
      return res.status(404).json({ success: false, error: "Lesson not found" });
    }

    const lesson = {
      id: lessonDoc.id,
      ...lessonDoc.data(),
    };
    if (lesson.studentPhone !== phone) {
      return res.status(403).json({
        success: false,
        error: "You are not authorized to mark this lesson as done",
      });
    }

    await lessonDocRef.update({ completed: true });
    res.status(200).json({ success: true, message: "Lesson marked as done" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Thay đổi thông tin sinh viên
const editStudentProfile = async (req, res) => {
  const { phone, name, email, newPhone } = req.body;

  if (!phone) {
    return res.status(400).json({
      success: false,
      error: "Phone number is required",
    });
  }

  try {
    const studentsRef = firestoreDB.collection("students");

    // Tìm student bằng phone hiện tại
    const query = studentsRef.where("phone", "==", phone);
    const studentsSnapshot = await query.get();

    if (studentsSnapshot.empty) {
      return res.status(404).json({
        success: false,
        error: "Student not found",
      });
    }

    const studentDoc = studentsSnapshot.docs[0];

    const updateData = {};

    // Update name
    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          error: "Name cannot be empty",
        });
      }

      updateData.name = name.trim();
    }

    // Update email
    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          error: "Invalid email format",
        });
      }

      // Kiểm tra email có thuộc student khác không
      const emailQuery = studentsRef.where("email", "==", email);
      const emailSnapshot = await emailQuery.get();

      const emailExists = emailSnapshot.docs.some((doc) => doc.id !== studentDoc.id);

      if (emailExists) {
        return res.status(409).json({
          success: false,
          error: "Email already exists",
        });
      }

      updateData.email = email;
    }

    // Update phone
    if (newPhone !== undefined && newPhone !== phone) {
      const phoneRegex = /^\+84\d{9}$/;

      if (!phoneRegex.test(newPhone)) {
        return res.status(400).json({
          success: false,
          error: "Invalid phone number format",
        });
      }

      // Kiểm tra phone mới có thuộc student khác không
      const phoneQuery = studentsRef.where("phone", "==", newPhone);
      const phoneSnapshot = await phoneQuery.get();

      if (!phoneSnapshot.empty) {
        return res.status(409).json({
          success: false,
          error: "Phone number already exists",
        });
      }

      updateData.phone = newPhone;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: "No data provided to update",
      });
    }

    // Nếu đổi phone thì phải đổi studentPhone của lessons
    if (updateData.phone) {
      const lessonsRef = firestoreDB.collection("lessons");
      const lessonsQuery = lessonsRef.where("studentPhone", "==", phone);

      const lessonsSnapshot = await lessonsQuery.get();

      const batch = firestoreDB.batch();

      batch.update(studentDoc.ref, updateData);

      lessonsSnapshot.forEach((lessonDoc) => {
        batch.update(lessonDoc.ref, {
          studentPhone: newPhone,
        });
      });

      await batch.commit();
    } else {
      await studentDoc.ref.update(updateData);
    }

    const updatedStudentDoc = await studentDoc.ref.get();

    return res.status(200).json({
      success: true,
      message: "Student profile updated successfully",
      student: {
        id: updatedStudentDoc.id,
        ...updatedStudentDoc.data(),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  getStudentById,
  getMyLessons,
  markLessonDone,
  editStudentProfile,
};
