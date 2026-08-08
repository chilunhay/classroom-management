import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./SetupAccount.css";

const SetupAccount = () => {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!token) {
      setError("Invalid verification link");
      return;
    }

    if (!username || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    try {
      setLoading(true);

      const response = await axios.post("http://localhost:5000/setupAccount", {
        token,
        username,
        password,
      });

      setSuccess(response.data.message);

      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (error) {
      setError(error.response?.data?.error || "Failed to setup account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="setup-page">
      <div className="setup-card">
        <h1>Setup Account</h1>

        <p className="setup-subtitle">Create your username and password</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>

            <input
              type="text"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Password</label>

            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Confirm Password</label>

            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {error && <p className="setup-error">{error}</p>}

          {success && <p className="setup-success">{success}</p>}

          <button type="submit" disabled={loading}>
            {loading ? "Setting up..." : "Setup Account"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SetupAccount;
