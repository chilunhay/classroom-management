const firestoreDB = require("../firebaseInit");
const twilio = require("twilio");
const bcrypt = require("bcryptjs");

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

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

module.exports = { createAccessCode, validateAccessCode, setupAccount };
