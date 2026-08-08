import { useEffect, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import { FiBookOpen, FiMessageCircle, FiUser, FiLogOut } from "react-icons/fi";

import "./StudentDashboard.css";

const socket = io("http://localhost:5000");

function StudentDashboard() {
  const [student, setStudent] = useState(() => {
    const savedStudent = localStorage.getItem("student");

    return savedStudent ? JSON.parse(savedStudent) : null;
  });
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState(student?.name || "");
  const [email, setEmail] = useState(student?.email || "");
  const [phone, setPhone] = useState(student?.phone || "");
  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [activeTab, setActiveTab] = useState("lessons");

  const navigate = useNavigate();

  useEffect(() => {
    const fetchStudentProfile = async () => {
      try {
        const savedStudent = JSON.parse(localStorage.getItem("student"));

        if (!savedStudent?.id) {
          navigate("/");
          return;
        }

        const response = await axios.get(`http://localhost:5000/student/profile/${savedStudent.id}`);

        const latestStudent = response.data.student;

        setStudent(latestStudent);
        setName(latestStudent.name);
        setEmail(latestStudent.email);
        setPhone(latestStudent.phone);

        localStorage.setItem("student", JSON.stringify(latestStudent));
      } catch (error) {
        console.error("Failed to fetch student profile:", error);
      }
    };

    fetchStudentProfile();
  }, []);

  useEffect(() => {
    if (!student) {
      navigate("/");
    }
  }, [student, navigate]);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!student?.id) return;

      try {
        const response = await axios.get(`http://localhost:5000/messages/${student.id}`);

        setMessages(response.data.messages);
      } catch (error) {
        console.error("Failed to load messages:", error);
      }
    };

    fetchMessages();
  }, [student?.id]);

  useEffect(() => {
    if (!student?.id) return;

    const roomId = student.id;

    // Join room bằng student ID
    socket.emit("joinRoom", roomId);

    // Nhận message realtime
    const handleReceiveMessage = (data) => {
      if (data.roomId === roomId) {
        setMessages((prev) => [...prev, data]);
      }
    };

    socket.on("receiveMessage", handleReceiveMessage);

    return () => {
      socket.off("receiveMessage", handleReceiveMessage);
    };
  }, [student?.id]);

  useEffect(() => {
    const getLessons = async () => {
      if (!student?.phone) {
        setError("Student information not found");
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get("http://localhost:5000/myLessons", {
          params: {
            phone: student.phone,
          },
        });

        setLessons(response.data.lessons);
      } catch (error) {
        setError(error.response?.data?.error || "Failed to get lessons");
      } finally {
        setLoading(false);
      }
    };

    getLessons();
  }, [student?.phone]);

  if (loading) {
    return <p>Loading...</p>;
  }

  const handleMarkDone = async (lessonId) => {
    try {
      await axios.post("http://localhost:5000/markLessonDone", {
        phone: student.phone,
        lessonId,
      });

      // Cập nhật giao diện ngay sau khi thành công
      setLessons((prevLessons) =>
        prevLessons.map((lesson) => (lesson.id === lessonId ? { ...lesson, completed: true } : lesson)),
      );
    } catch (error) {
      setError(error.response?.data?.error || "Failed to mark lesson as done");
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const response = await axios.put("http://localhost:5000/editProfile", {
        phone: student.phone,
        name,
        email,
        newPhone: phone,
      });

      const updatedStudent = response.data.student;

      localStorage.setItem("student", JSON.stringify(updatedStudent));

      setStudent(updatedStudent);
      setPhone(updatedStudent.phone);
      setName(updatedStudent.name);
      setEmail(updatedStudent.email);

      setError("");
      alert(response.data.message);
    } catch (error) {
      setError(error.response?.data?.error || "Failed to update profile");
    }
  };

  const handleSendMessage = () => {
    if (!chatMessage.trim() || !student?.id) return;

    socket.emit("sendMessage", {
      roomId: student.id,
      sender: "student",
      message: chatMessage.trim(),
    });

    setChatMessage("");
  };

  const handleLogout = () => {
    localStorage.removeItem("student");
    navigate("/");
  };

  return (
    <div className="student-layout">
      <aside className="student-sidebar">
        <div className="student-sidebar-logo">
          <h2>Classroom</h2>
          <p>Management</p>
        </div>

        <div className="student-sidebar-menu">
          <button className={activeTab === "lessons" ? "active" : ""} onClick={() => setActiveTab("lessons")}>
            <FiBookOpen className="menu-icon" />
            <span>My Lessons</span>
          </button>

          <button className={activeTab === "messages" ? "active" : ""} onClick={() => setActiveTab("messages")}>
            <FiMessageCircle className="menu-icon" />
            <span>Messages</span>
          </button>

          <button className={activeTab === "profile" ? "active" : ""} onClick={() => setActiveTab("profile")}>
            <FiUser className="menu-icon" />
            <span>My Profile</span>
          </button>
        </div>

        <button className="student-logout" onClick={handleLogout}>
          <FiLogOut />
          <span>Logout</span>
        </button>
      </aside>

      <main className="student-main">
        <header className="student-header">
          <div>
            <h3>Student Dashboard</h3>
            <p>Welcome, {student?.name}</p>
          </div>

          <div className="student-avatar">
            <FiUser />
          </div>
        </header>

        {error && <div className="student-error">{error}</div>}

        {activeTab === "lessons" && (
          <section className="student-content">
            <div className="student-title">
              <h2>My Lessons</h2>
              <p>View your assigned lessons and track your progress.</p>
            </div>

            {lessons.length === 0 ? (
              <div className="empty-lessons">
                <FiBookOpen />
                <p>No lessons assigned.</p>
              </div>
            ) : (
              <div className="student-lesson-list">
                {lessons.map((lesson) => (
                  <div className="student-lesson-card" key={lesson.id}>
                    <div className="lesson-icon">
                      <FiBookOpen />
                    </div>

                    <div className="lesson-content">
                      <h3>{lesson.title}</h3>
                      <p>{lesson.description}</p>
                    </div>

                    <div className="lesson-action">
                      <span className={lesson.completed ? "student-status completed" : "student-status pending"}>
                        {lesson.completed ? "Completed" : "Pending"}
                      </span>

                      {!lesson.completed && (
                        <button className="done-button" onClick={() => handleMarkDone(lesson.id)}>
                          Mark as Done
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === "messages" && (
          <section className="student-message-layout">
            <div className="instructor-list">
              <h3>Messages</h3>

              <div className="instructor-item active">
                <div className="chat-avatar">
                  <FiUser />
                </div>

                <div>
                  <strong>Instructor</strong>
                  <span>Classroom Instructor</span>
                </div>
              </div>
            </div>

            <div className="student-chat-panel">
              <div className="student-chat-header">
                <div className="chat-avatar">
                  <FiUser />
                </div>

                <div>
                  <strong>Instructor</strong>
                  <span>Classroom Instructor</span>
                </div>
              </div>

              <div className="student-chat-messages">
                {messages.length === 0 ? (
                  <p className="no-messages">No messages yet.</p>
                ) : (
                  messages.map((msg, index) => (
                    <div key={index} className={`student-message ${msg.sender === "student" ? "sent" : "received"}`}>
                      {msg.message}
                    </div>
                  ))
                )}
              </div>

              <div className="student-chat-input">
                <input
                  type="text"
                  placeholder="Reply message..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSendMessage();
                    }
                  }}
                />

                <button onClick={handleSendMessage}>Send</button>
              </div>
            </div>
          </section>
        )}

        {activeTab === "profile" && (
          <section className="student-content">
            <div className="student-title">
              <h2>My Profile</h2>
              <p>View and update your personal information.</p>
            </div>

            <div className="profile-card">
              <div className="profile-heading">
                <div className="profile-avatar">
                  <FiUser />
                </div>

                <div>
                  <h3>{student?.name}</h3>
                  <p>{student?.email}</p>
                </div>
              </div>

              <div className="profile-form">
                <div>
                  <label>Name</label>

                  <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>

                <div>
                  <label>Email Address</label>

                  <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>

                <div>
                  <label>Phone Number</label>
                  <input
                    type="text"
                    placeholder="Phone Number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                <div>
                  <label>Role</label>
                  <input type="text" value="Student" disabled />
                </div>
              </div>

              <div className="profile-actions">
                <button onClick={handleUpdateProfile}>Update Profile</button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default StudentDashboard;
