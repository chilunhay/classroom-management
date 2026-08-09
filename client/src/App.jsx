import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import StudentDashboard from "./pages/StudentDashboard";
import InstructorDashboard from "./pages/InstructorDashboard";
import SetupAccount from "./pages/SetupAccount";

function HomeRedirect() {
  const student = localStorage.getItem("student");
  const instructor = localStorage.getItem("instructor");

  if (student) {
    return <Navigate to="/student" replace />;
  }

  if (instructor) {
    return <Navigate to="/instructor" replace />;
  }

  return <Navigate to="/login" replace />;
}

function ProtectedRoute({ children, role }) {
  const user = localStorage.getItem(role);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Home */}
        <Route path="/" element={<HomeRedirect />} />

        {/* Login */}
        <Route path="/login" element={<Login />} />

        {/* Setup account */}
        <Route path="/setup-account" element={<SetupAccount />} />

        {/* Student */}
        <Route
          path="/student"
          element={
            <ProtectedRoute role="student">
              <StudentDashboard />
            </ProtectedRoute>
          }
        />

        {/* Instructor */}
        <Route
          path="/instructor"
          element={
            <ProtectedRoute role="instructor">
              <InstructorDashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
