import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import StudentDashboard from "./pages/StudentDashboard";
import InstructorDashboard from "./pages/InstructorDashboard";
import SetupAccount from "./pages/SetupAccount";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/setup-account" element={<SetupAccount />} />
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/instructor" element={<InstructorDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
