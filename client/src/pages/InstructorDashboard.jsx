import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import "./InstructorDashboard.css";
import { FiUsers, FiBookOpen, FiMessageCircle, FiLogOut, FiUser } from "react-icons/fi";

const socket = io("http://localhost:5000");

function InstructorDashboard() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentLessons, setStudentLessons] = useState([]);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonDescription, setLessonDescription] = useState("");
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentPhone, setNewStudentPhone] = useState("");
  const [newStudentEmail, setNewStudentEmail] = useState("");
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [activePage, setActivePage] = useState("students");
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [searchStudent, setSearchStudent] = useState("");

  const navigate = useNavigate();

  const instructor = JSON.parse(localStorage.getItem("instructor"));

  useEffect(() => {
    if (!instructor) {
      navigate("/");
    }
  }, [instructor, navigate]);

  useEffect(() => {
    const getStudents = async () => {
      try {
        const response = await axios.get("http://localhost:5000/students");

        setStudents(response.data.students);
      } catch (error) {
        setError(error.response?.data?.error || "Failed to get students");
      } finally {
        setLoading(false);
      }
    };

    getStudents();
  }, []);

  useEffect(() => {
    if (!selectedStudent?.id) return;

    const roomId = selectedStudent.id;

    socket.emit("joinRoom", roomId);

    const handleReceiveMessage = (data) => {
      if (data.roomId === roomId) {
        setMessages((prev) => [...prev, data]);
      }
    };

    socket.on("receiveMessage", handleReceiveMessage);

    return () => {
      socket.off("receiveMessage", handleReceiveMessage);
    };
  }, [selectedStudent?.id]);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedStudent?.id) {
        setMessages([]);
        return;
      }

      try {
        const response = await axios.get(`http://localhost:5000/messages/${selectedStudent.id}`);

        setMessages(response.data.messages);
      } catch (error) {
        console.error("Failed to load messages:", error);

        setMessages([]);
      }
    };

    fetchMessages();
  }, [selectedStudent?.id]);

  if (loading) {
    return <p>Loading...</p>;
  }

  const handleViewStudent = async (phone) => {
    try {
      setError("");

      const response = await axios.get(`http://localhost:5000/student/${phone}`);

      setSelectedStudent(response.data.student);
      setStudentLessons(response.data.lessons);
      setEditName(response.data.student.name);
      setEditEmail(response.data.student.email);
      setEditPhone(response.data.student.phone);
    } catch (error) {
      setError(error.response?.data?.error || "Failed to get student information");
    }
  };

  const handleAssignLesson = async () => {
    if (!selectedStudent) {
      setError("Please select a student");
      return;
    }

    if (!lessonTitle || !lessonDescription) {
      setError("Title and description are required");
      return;
    }

    try {
      setError("");

      const response = await axios.post("http://localhost:5000/assignLesson", {
        studentPhone: selectedStudent.phone,
        title: lessonTitle,
        description: lessonDescription,
      });

      const newLesson = {
        id: response.data.lessonId,
        studentPhone: selectedStudent.phone,
        title: lessonTitle,
        description: lessonDescription,
        completed: false,
      };

      setStudentLessons((prev) => [...prev, newLesson]);

      setLessonTitle("");
      setLessonDescription("");
    } catch (error) {
      setError(error.response?.data?.error || "Failed to assign lesson");
    }
  };

  const handleAddStudent = async () => {
    if (!newStudentName || !newStudentPhone || !newStudentEmail) {
      setError("Name, phone and email are required");
      return;
    }

    try {
      setError("");

      const response = await axios.post("http://localhost:5000/addStudent", {
        name: newStudentName,
        phone: newStudentPhone,
        email: newStudentEmail,
      });

      const newStudent = {
        id: response.data.studentId,
        name: newStudentName,
        phone: newStudentPhone,
        email: newStudentEmail,
        role: "student",
      };

      setStudents((prev) => [...prev, newStudent]);

      setNewStudentName("");
      setNewStudentPhone("");
      setNewStudentEmail("");
      setShowAddStudent(false);
    } catch (error) {
      setError(error.response?.data?.error || "Failed to add student");
    }
  };

  const handleEditStudent = async () => {
    try {
      const response = await axios.put(`http://localhost:5000/editStudent/${selectedStudent.phone}`, {
        name: editName,
        email: editEmail,
        newPhone: editPhone,
      });

      const updatedStudent = response.data.student;

      setSelectedStudent(updatedStudent);

      setStudents((prevStudents) =>
        prevStudents.map((student) => (student.id === updatedStudent.id ? updatedStudent : student)),
      );

      setEditName(updatedStudent.name);
      setEditEmail(updatedStudent.email);
      setEditPhone(updatedStudent.phone);

      setError("");
      alert(response.data.message);
    } catch (error) {
      setError(error.response?.data?.error || "Failed to update student");
    }
  };

  const handleDeleteStudent = async () => {
    if (!selectedStudent) return;

    const confirmed = window.confirm(`Are you sure you want to delete ${selectedStudent.name}?`);

    if (!confirmed) return;

    try {
      setError("");

      await axios.delete(`http://localhost:5000/student/${selectedStudent.phone}`);

      setStudents((prev) => prev.filter((student) => student.phone !== selectedStudent.phone));

      setSelectedStudent(null);
      setStudentLessons([]);
    } catch (error) {
      setError(error.response?.data?.error || "Failed to delete student");
    }
  };

  const handleSendMessage = () => {
    if (!selectedStudent?.id || !chatMessage.trim()) {
      return;
    }

    socket.emit("sendMessage", {
      roomId: selectedStudent.id,
      sender: "instructor",
      message: chatMessage.trim(),
    });

    setChatMessage("");
  };

  const handleLogout = () => {
    localStorage.removeItem("instructor");
    navigate("/login", { replace: true });
  };

  const filteredStudents = students.filter((student) =>
    student.name.toLowerCase().includes(searchStudent.toLowerCase()),
  );

  return (
    <div className="instructor-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h2>Classroom</h2>
          <p>Management</p>
        </div>

        <div className="sidebar-menu">
          <button className={activePage === "students" ? "active" : ""} onClick={() => setActivePage("students")}>
            <FiUsers className="menu-icon" />
            <span>Manage Students</span>
          </button>

          <button className={activePage === "lessons" ? "active" : ""} onClick={() => setActivePage("lessons")}>
            <FiBookOpen className="menu-icon" />
            <span>Manage Lessons</span>
          </button>

          <button className={activePage === "messages" ? "active" : ""} onClick={() => setActivePage("messages")}>
            <FiMessageCircle className="menu-icon" />
            <span>Messages</span>
          </button>
        </div>

        <button className="logout-button" onClick={handleLogout}>
          <FiLogOut className="logout-icon" />
          <span>Logout</span>
        </button>
      </aside>

      {/* Main */}
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <h3>Instructor Dashboard</h3>
            <p>{instructor?.name || "Instructor"}</p>
          </div>

          <div className="avatar">
            <FiUser />
          </div>
        </header>

        {error && <div className="error-message">{error}</div>}

        {/* STUDENTS */}
        {activePage === "students" && (
          <section className="content-card">
            <div className="section-header">
              <div>
                <h2>Manage Students</h2>
                <p>{students.length} Students</p>
              </div>

              <div className="student-actions">
                <input
                  type="text"
                  placeholder="Search student..."
                  value={searchStudent}
                  onChange={(e) => setSearchStudent(e.target.value)}
                />

                <button className="primary-button" onClick={() => setShowAddStudent(true)}>
                  + Add Student
                </button>
              </div>
            </div>

            <div className="student-table-wrapper">
              <table className="student-table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredStudents.map((student) => (
                    <tr key={student.id}>
                      <td>{student.name}</td>
                      <td>{student.email}</td>
                      <td>{student.phone}</td>

                      <td>
                        <span className="status-active">Active</span>
                      </td>

                      <td>
                        <button className="edit-button" onClick={() => handleViewStudent(student.phone)}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredStudents.length === 0 && <p className="empty-message">No students found.</p>}

            {/* Student Detail */}
            {selectedStudent && (
              <div className="student-detail">
                <div className="detail-header">
                  <h3>Student Details</h3>

                  <button className="close-button" onClick={() => setSelectedStudent(null)}>
                    ×
                  </button>
                </div>

                <div className="detail-info">
                  <p>
                    <strong>Name:</strong> {selectedStudent.name}
                  </p>

                  <p>
                    <strong>Phone:</strong> {selectedStudent.phone}
                  </p>

                  <p>
                    <strong>Email:</strong> {selectedStudent.email}
                  </p>
                </div>

                <h4>Edit Student</h4>

                <div className="edit-form">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Student name"
                  />

                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="Email"
                  />

                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="Phone number"
                  />

                  <button className="primary-button" onClick={handleEditStudent}>
                    Update
                  </button>

                  <button className="delete-button" onClick={handleDeleteStudent}>
                    Delete
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* LESSONS */}
        {activePage === "lessons" && (
          <section className="content-card">
            <h2>Manage Lessons</h2>

            <p className="section-description">Select a student to view and assign lessons.</p>

            <select
              className="student-select"
              value={selectedStudent?.phone || ""}
              onChange={(e) => {
                if (e.target.value) {
                  handleViewStudent(e.target.value);
                }
              }}
            >
              <option value="">Select student</option>

              {students.map((student) => (
                <option key={student.id} value={student.phone}>
                  {student.name}
                </option>
              ))}
            </select>

            {selectedStudent && (
              <>
                <div className="lesson-list">
                  <h3>Lessons for {selectedStudent.name}</h3>

                  {studentLessons.length === 0 ? (
                    <p>No lessons assigned.</p>
                  ) : (
                    studentLessons.map((lesson) => (
                      <div className="lesson-item" key={lesson.id}>
                        <div>
                          <h4>{lesson.title}</h4>
                          <p>{lesson.description}</p>
                        </div>

                        <span className={lesson.completed ? "lesson-completed" : "lesson-pending"}>
                          {lesson.completed ? "Completed" : "Pending"}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="assign-lesson">
                  <h3>Assign New Lesson</h3>

                  <input
                    type="text"
                    placeholder="Lesson title"
                    value={lessonTitle}
                    onChange={(e) => setLessonTitle(e.target.value)}
                  />

                  <textarea
                    placeholder="Lesson description"
                    value={lessonDescription}
                    onChange={(e) => setLessonDescription(e.target.value)}
                  />

                  <button className="primary-button" onClick={handleAssignLesson}>
                    Assign Lesson
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {/* MESSAGES */}
        {activePage === "messages" && (
          <section className="message-layout">
            <div className="conversation-list">
              <h3>Messages</h3>

              {students.map((student) => (
                <button
                  key={student.id}
                  className={selectedStudent?.id === student.id ? "conversation active" : "conversation"}
                  onClick={() => handleViewStudent(student.phone)}
                >
                  <div className="conversation-avatar">{student.name.charAt(0).toUpperCase()}</div>

                  <div>
                    <strong>{student.name}</strong>
                    <span>{student.email}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="chat-panel">
              {!selectedStudent ? (
                <div className="no-chat">Select a student to start chatting</div>
              ) : (
                <>
                  <div className="chat-header">
                    <div className="conversation-avatar">{selectedStudent.name.charAt(0).toUpperCase()}</div>

                    <div>
                      <strong>{selectedStudent.name}</strong>
                      <span>{selectedStudent.email}</span>
                    </div>
                  </div>

                  <div className="chat-messages">
                    {messages.length === 0 && <p className="empty-chat">No messages yet.</p>}

                    {messages.map((msg, index) => (
                      <div
                        key={index}
                        className={msg.sender === "instructor" ? "message-bubble sent" : "message-bubble received"}
                      >
                        {msg.message}
                      </div>
                    ))}
                  </div>

                  <div className="chat-input">
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
                </>
              )}
            </div>
          </section>
        )}
      </main>

      {/* ADD STUDENT MODAL */}
      {showAddStudent && (
        <div className="modal-overlay">
          <div className="student-modal">
            <div className="modal-header">
              <h2>Create Student</h2>

              <button onClick={() => setShowAddStudent(false)}>×</button>
            </div>

            <div className="modal-form">
              <div>
                <label>Student Name</label>

                <input
                  type="text"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="Enter student name"
                />
              </div>

              <div>
                <label>Phone Number</label>

                <input
                  type="text"
                  value={newStudentPhone}
                  onChange={(e) => setNewStudentPhone(e.target.value)}
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <label>Email Address</label>

                <input
                  type="email"
                  value={newStudentEmail}
                  onChange={(e) => setNewStudentEmail(e.target.value)}
                  placeholder="Enter email"
                />
              </div>

              <div>
                <label>Role</label>
                <input value="Student" disabled />
              </div>
            </div>

            <div className="modal-actions">
              <button className="cancel-button" onClick={() => setShowAddStudent(false)}>
                Cancel
              </button>

              <button className="primary-button" onClick={handleAddStudent}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InstructorDashboard;
