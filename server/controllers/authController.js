const firestoreDB = require("../firebaseInit");
const twilio = require("twilio");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Tạo mã truy cập và gửi SMS
const createAccessCode = async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({
      success: false,
      error: "Phone number is required",
    });
  }

  try {
    const accessCode = Math.floor(100000 + Math.random() * 900000).toString();

    const accessCodeRef = firestoreDB.collection("accessCodes").doc(phoneNumber);

    await accessCodeRef.set({
      phoneNumber,
      accessCode,
      createdAt: new Date(),
    });

    const isDevelopment = process.env.NODE_ENV !== "production";

    try {
      const message = await client.messages.create({
        body: `Your access code is: ${accessCode}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber,
      });

      console.log("SMS sent:", message.sid);
    } catch (smsError) {
      console.log("Twilio error:", smsError.code);
      console.log("Twilio message:", smsError.message);

      // DEV: vẫn giữ OTP để test
      if (isDevelopment) {
        console.log("================================");
        console.log("DEV ACCESS CODE:", accessCode);
        console.log("================================");

        return res.status(200).json({
          success: true,
          message: "Access code generated (development mode)",
          dev: true,
        });
      }

      // Production: SMS lỗi thì xóa OTP
      await accessCodeRef.delete();

      return res.status(500).json({
        success: false,
        error: "Failed to send access code",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Access code sent successfully",
    });
  } catch (error) {
    console.log("===== CREATE ACCESS CODE ERROR =====");
    console.log("message:", error.message);
    console.log("code:", error.code);
    console.log("status:", error.status);
    console.log("moreInfo:", error.moreInfo);

    return res.status(500).json({
      success: false,
      error: error.message,
      code: error.code,
      status: error.status,
    });
  }
};

// Xác thực mã truy cập
const validateAccessCode = async (req, res) => {
  const { phoneNumber, accessCode } = req.body;

  if (!phoneNumber || !accessCode) {
    return res.status(400).json({
      success: false,
      error: "Phone number and access code are required",
    });
  }

  try {
    const accessCodeRef = firestoreDB.collection("accessCodes").doc(phoneNumber);

    const accessCodeDoc = await accessCodeRef.get();

    if (!accessCodeDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "Access code not found",
      });
    }

    const { accessCode: storedAccessCode, createdAt } = accessCodeDoc.data();

    // Kiểm tra thời hạn access code: 10 phút
    const createdTime = createdAt.toDate().getTime();
    const currentTime = Date.now();
    const expirationTime = 10 * 60 * 1000;

    if (currentTime - createdTime > expirationTime) {
      await accessCodeRef.delete();

      return res.status(401).json({
        success: false,
        error: "Access code has expired",
      });
    }

    // Kiểm tra access code
    if (accessCode !== storedAccessCode) {
      return res.status(401).json({
        success: false,
        error: "Invalid access code",
      });
    }

    // Tìm Student
    const studentsRef = firestoreDB.collection("students");

    const studentQuery = studentsRef.where("phone", "==", phoneNumber);

    const studentSnapshot = await studentQuery.get();

    if (!studentSnapshot.empty) {
      const studentDoc = studentSnapshot.docs[0];
      const studentData = studentDoc.data();

      // Xóa code sau khi đăng nhập thành công
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

    // Không phải Student → tìm Instructor
    const instructorsRef = firestoreDB.collection("instructors");

    const instructorQuery = instructorsRef.where("phone", "==", phoneNumber);

    const instructorSnapshot = await instructorQuery.get();

    if (!instructorSnapshot.empty) {
      const instructorDoc = instructorSnapshot.docs[0];
      const instructorData = instructorDoc.data();

      // Xóa code sau khi đăng nhập thành công
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

// Setup tài khoản sau khi nhấn link verification
const setupAccount = async (req, res) => {
  const { token, username, password } = req.body;

  if (!token || !username || !password) {
    return res.status(400).json({
      success: false,
      error: "Token, username and password are required",
    });
  }

  if (username.trim().length < 3) {
    return res.status(400).json({
      success: false,
      error: "Username must be at least 3 characters",
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      error: "Password must be at least 6 characters",
    });
  }

  try {
    const verificationRef = firestoreDB.collection("verificationTokens").doc(token);

    const verificationDoc = await verificationRef.get();

    if (!verificationDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "Invalid verification token",
      });
    }

    const verificationData = verificationDoc.data();

    const expiresAt = verificationData.expiresAt.toDate();

    if (Date.now() > expiresAt.getTime()) {
      await verificationRef.delete();

      return res.status(401).json({
        success: false,
        error: "Verification token has expired",
      });
    }

    const { studentId } = verificationData;

    const studentRef = firestoreDB.collection("students").doc(studentId);

    const studentDoc = await studentRef.get();

    if (!studentDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "Student not found",
      });
    }

    const usernameQuery = firestoreDB.collection("students").where("username", "==", username);

    const usernameSnapshot = await usernameQuery.get();

    if (!usernameSnapshot.empty) {
      return res.status(409).json({
        success: false,
        error: "Username already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await studentRef.update({
      username,
      passwordHash,
      accountSetup: true,
    });

    await verificationRef.delete();

    return res.status(200).json({
      success: true,
      message: "Account setup successfully",
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
  createAccessCode,
  validateAccessCode,
  setupAccount,
  loginUsernamePassword,
  loginEmail,
  validateEmailAccessCode,
};
