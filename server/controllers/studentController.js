const nodemailer = require("nodemailer");
const firestoreDB = require("../firebaseInit");
const bcrypt = require("bcryptjs");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

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

// Đăng nhập bằng username + password
const loginUsernamePassword = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: "Username and password are required",
    });
  }

  try {
    const studentsRef = firestoreDB.collection("students");

    const snapshot = await studentsRef.where("username", "==", username).get();

    if (snapshot.empty) {
      return res.status(401).json({
        success: false,
        error: "Invalid username or password",
      });
    }

    const studentDoc = snapshot.docs[0];
    const studentData = studentDoc.data();

    if (!studentData.passwordHash) {
      return res.status(401).json({
        success: false,
        error: "Account has not been setup yet",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, studentData.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: "Invalid username or password",
      });
    }

    return res.status(200).json({
      success: true,
      role: studentData.role,
      message: "Login successful",
      student: {
        id: studentDoc.id,
        ...studentData,
        passwordHash: undefined,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Đăng nhập qua Email
const loginEmail = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      error: "Email is required",
    });
  }

  try {
    let userData = null;

    // Tìm trong students
    const studentsRef = firestoreDB.collection("students");
    const studentQuery = studentsRef.where("email", "==", email);
    const studentSnapshot = await studentQuery.get();

    if (!studentSnapshot.empty) {
      userData = studentSnapshot.docs[0].data();
    }

    // Không phải student → tìm instructor
    if (!userData) {
      const instructorsRef = firestoreDB.collection("instructors");
      const instructorQuery = instructorsRef.where("email", "==", email);
      const instructorSnapshot = await instructorQuery.get();

      if (!instructorSnapshot.empty) {
        userData = instructorSnapshot.docs[0].data();
      }
    }

    // Không tìm thấy ở cả 2 collection
    if (!userData) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Tạo access code 6 số
    const accessCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Lưu code vào Firestore
    const accessCodeRef = firestoreDB.collection("emailAccessCodes").doc(email);

    await accessCodeRef.set({
      email,
      accessCode,
      createdAt: new Date(),
    });

    // Gửi code qua email
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Your Access Code",
        text: `Your access code is: ${accessCode}`,
      });
    } catch (emailError) {
      // Nếu gửi email thất bại thì xóa code vừa tạo
      await accessCodeRef.delete();

      console.log("Email could not be sent:", emailError.message);

      return res.status(500).json({
        success: false,
        error: "Failed to send access code",
      });
    }

    return res.status(200).json({
      success: true,
      role: userData.role,
      message: "Access code sent successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// Xác thực mã truy cập bằng email
const validateEmailAccessCode = async (req, res) => {
  const { email, accessCode } = req.body;

  if (!email || !accessCode) {
    return res.status(400).json({
      success: false,
      error: "Email and access code are required",
    });
  }

  try {
    const accessCodeRef = firestoreDB.collection("emailAccessCodes").doc(email);
    const accessCodeDoc = await accessCodeRef.get();
    if (!accessCodeDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "Access code not found",
      });
    }
    const { accessCode: storedAccessCode, createdAt } = accessCodeDoc.data();

    const createdTime = createdAt.toDate ? createdAt.toDate().getTime() : new Date(createdAt).getTime();

    const expired = Date.now() - createdTime > 10 * 60 * 1000;

    if (expired) {
      await accessCodeRef.delete();

      return res.status(401).json({
        success: false,
        error: "Access code has expired",
      });
    }

    if (accessCode !== storedAccessCode) {
      return res.status(401).json({
        success: false,
        error: "Invalid access code",
      });
    }

    // Tìm Student theo email
    const studentsRef = firestoreDB.collection("students");
    const studentQuery = studentsRef.where("email", "==", email);
    const studentSnapshot = await studentQuery.get();

    if (!studentSnapshot.empty) {
      const studentDoc = studentSnapshot.docs[0];
      const studentData = studentDoc.data();

      await accessCodeRef.delete();

      return res.status(200).json({
        success: true,
        role: studentData.role,
        message: "Access code is valid",
        student: {
          id: studentDoc.id,
          ...studentData,
        },
      });
    }

    // Không tìm thấy Student → tìm Instructor
    const instructorsRef = firestoreDB.collection("instructors");
    const instructorQuery = instructorsRef.where("email", "==", email);
    const instructorSnapshot = await instructorQuery.get();

    if (!instructorSnapshot.empty) {
      const instructorDoc = instructorSnapshot.docs[0];
      const instructorData = instructorDoc.data();

      await accessCodeRef.delete();

      return res.status(200).json({
        success: true,
        role: instructorData.role,
        message: "Access code is valid",
        instructor: {
          id: instructorDoc.id,
          ...instructorData,
        },
      });
    }

    // Không có trong cả 2 collection
    return res.status(404).json({
      success: false,
      error: "User not found",
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
  loginUsernamePassword,
  loginEmail,
  validateEmailAccessCode,
};
