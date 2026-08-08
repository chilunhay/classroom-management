const firestoreDB = require("../firebaseInit");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Thêm sinh viên vào lớp học
const addStudent = async (req, res) => {
  const { name, phone, email } = req.body;

  if (!name || !phone || !email) {
    return res.status(400).json({
      success: false,
      error: "Name, phone and email are required",
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: "Invalid email format",
    });
  }

  const phoneRegex = /^\+84\d{9}$/;

  if (!phoneRegex.test(phone)) {
    return res.status(400).json({
      success: false,
      error: "Invalid phone number format",
    });
  }
  try {
    const studentsCollectionRef = firestoreDB.collection("students");
    // Kiểm tra số điện thoại đã tồn tại
    const phoneQuery = studentsCollectionRef.where("phone", "==", phone);
    const phoneSnapshot = await phoneQuery.get();

    if (!phoneSnapshot.empty) {
      return res.status(409).json({
        success: false,
        error: "Phone number already exists",
      });
    }

    // Kiểm tra email đã tồn tại
    const emailQuery = studentsCollectionRef.where("email", "==", email);
    const emailSnapshot = await emailQuery.get();

    if (!emailSnapshot.empty) {
      return res.status(409).json({
        success: false,
        error: "Email already exists",
      });
    }

    const student = await studentsCollectionRef.add({
      name,
      phone,
      email,
      role: "student",
    });

    const studentId = student.id;

    const verificationToken = crypto.randomBytes(32).toString("hex");

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await firestoreDB.collection("verificationTokens").doc(verificationToken).set({
      studentId,
      createdAt: new Date(),
      expiresAt,
    });

    const verificationLink = `http://localhost:5173/setup-account?token=${verificationToken}`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Classroom Management - Account Created",
      text: `
    Hello ${name},

    Your student account has been created successfully.

    Please click the link below to set up your account:

    ${verificationLink}

    This verification link will expire in 24 hours.

    Thank you.
      `,
    });
    res.status(201).json({ success: true, studentId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Lấy danh sách sinh viên
const getStudents = async (req, res) => {
  try {
    const studentsRef = firestoreDB.collection("students");
    const studentsSnapshot = await studentsRef.get();
    const students = [];
    studentsSnapshot.forEach((studentDoc) => {
      students.push({ id: studentDoc.id, ...studentDoc.data() });
    });
    res.status(200).json({ success: true, students });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Lấy sinh viên theo Số điện thoại
const getStudentByPhone = async (req, res) => {
  const { phone } = req.params;
  try {
    const studentsRef = firestoreDB.collection("students");
    const query = studentsRef.where("phone", "==", phone);
    const studentSnapshot = await query.get();

    if (studentSnapshot.empty) {
      return res.status(404).json({ success: false, error: "Student not found" });
    }

    const studentDoc = studentSnapshot.docs[0];

    const student = { id: studentDoc.id, ...studentDoc.data() };

    const lessons = [];
    const lessonsRef = firestoreDB.collection("lessons");
    const lessonsQuery = lessonsRef.where("studentPhone", "==", phone);
    const lessonsSnapshot = await lessonsQuery.get();
    lessonsSnapshot.forEach((lessonDoc) => {
      lessons.push({ id: lessonDoc.id, ...lessonDoc.data() });
    });
    res.status(200).json({ success: true, student, lessons });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Sửa thông tin sinh viên
const editStudent = async (req, res) => {
  const { phone } = req.params;
  const { name, email, newPhone } = req.body;

  try {
    const studentsRef = firestoreDB.collection("students");

    const query = studentsRef.where("phone", "==", phone);
    const studentSnapshot = await query.get();

    if (studentSnapshot.empty) {
      return res.status(404).json({
        success: false,
        error: "Student not found",
      });
    }

    const studentDoc = studentSnapshot.docs[0];
    const updateData = {};

    // Name
    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          error: "Name cannot be empty",
        });
      }

      updateData.name = name.trim();
    }

    // Email
    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          error: "Invalid email format",
        });
      }

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

    // Phone
    if (newPhone !== undefined && newPhone !== phone) {
      const phoneRegex = /^\+84\d{9}$/;

      if (!phoneRegex.test(newPhone)) {
        return res.status(400).json({
          success: false,
          error: "Invalid phone number format",
        });
      }

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
        error: "No data provided for update",
      });
    }

    // Nếu đổi phone thì update luôn lessons
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
      message: "Student updated successfully",
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

// Xóa sinh viên và toàn bộ dữ liệu liên quan
const deleteStudent = async (req, res) => {
  const { phone } = req.params;

  try {
    const studentsRef = firestoreDB.collection("students");

    const studentSnapshot = await studentsRef.where("phone", "==", phone).get();

    if (studentSnapshot.empty) {
      return res.status(404).json({
        success: false,
        error: "Student not found",
      });
    }

    const studentDoc = studentSnapshot.docs[0];
    const studentId = studentDoc.id;

    const batch = firestoreDB.batch();

    const lessonsSnapshot = await firestoreDB.collection("lessons").where("studentPhone", "==", phone).get();

    lessonsSnapshot.forEach((lessonDoc) => {
      batch.delete(lessonDoc.ref);
    });

    const messagesSnapshot = await firestoreDB.collection("messages").where("roomId", "==", studentId).get();

    messagesSnapshot.forEach((messageDoc) => {
      batch.delete(messageDoc.ref);
    });

    batch.delete(studentDoc.ref);

    await batch.commit();

    return res.status(200).json({
      success: true,
      message: "Student, lessons and messages deleted successfully",
    });
  } catch (error) {
    console.error("Delete student error:", error);

    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Gán bài học cho sinh viên
const assignLesson = async (req, res) => {
  const { studentPhone, title, description } = req.body;

  if (!studentPhone || !title || !description) {
    return res.status(400).json({
      success: false,
      error: "Student phone, title and description are required",
    });
  }

  try {
    const studentsRef = firestoreDB.collection("students");

    const query = studentsRef.where("phone", "==", studentPhone);

    const studentsSnapshot = await query.get();

    if (studentsSnapshot.empty) {
      return res.status(404).json({ success: false, error: "Student not found" });
    }

    const lessonsRef = firestoreDB.collection("lessons");
    const lesson = await lessonsRef.add({
      studentPhone,
      title,
      description,
      completed: false,
    });

    res.status(201).json({
      success: true,
      lessonId: lesson.id,
      message: "Lesson assigned successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  addStudent,
  getStudents,
  getStudentByPhone,
  editStudent,
  deleteStudent,
  assignLesson,
};
