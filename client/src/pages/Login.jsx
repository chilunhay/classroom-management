import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./Login.css";

function Login() {
  const [loginType, setLoginType] = useState("username");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [value, setValue] = useState("");
  const [accessCode, setAccessCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [codeSent, setCodeSent] = useState(false);

  const navigate = useNavigate();

  // =========================
  // USERNAME + PASSWORD LOGIN
  // =========================
  const handleUsernameLogin = async () => {
    if (!username || !password) {
      setMessage("Please enter username and password");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const response = await axios.post("http://localhost:5000/loginUsernamePassword", {
        username,
        password,
      });

      if (response.data.role === "student") {
        localStorage.setItem("student", JSON.stringify(response.data.student));

        navigate("/student");
      } else {
        setMessage("Invalid user role");
      }
    } catch (error) {
      setMessage(error.response?.data?.error || "Invalid username or password");
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // SEND PHONE / EMAIL CODE
  // =========================
  const handleSendCode = async () => {
    if (!value) {
      setMessage(loginType === "phone" ? "Please enter your phone number" : "Please enter your email");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      let response;

      if (loginType === "phone") {
        response = await axios.post("http://localhost:5000/createAccessCode", {
          phoneNumber: value,
        });
      } else {
        response = await axios.post("http://localhost:5000/loginEmail", {
          email: value,
        });
      }

      console.log(response.data);

      setCodeSent(true);
      setMessage("Access code sent successfully");
    } catch (error) {
      console.error(error);

      setMessage(error.response?.data?.details || error.response?.data?.error || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // VERIFY PHONE / EMAIL CODE
  // =========================
  const handleVerifyCode = async () => {
    if (!accessCode) {
      setMessage("Please enter access code");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      let response;

      if (loginType === "email") {
        response = await axios.post("http://localhost:5000/validateEmailAccessCode", {
          email: value,
          accessCode,
        });
      } else {
        response = await axios.post("http://localhost:5000/validateAccessCode", {
          phoneNumber: value,
          accessCode,
        });
      }

      console.log(response.data);

      if (response.data.role === "instructor") {
        localStorage.setItem("instructor", JSON.stringify(response.data.instructor));

        navigate("/instructor");
      } else if (response.data.role === "student") {
        localStorage.setItem("student", JSON.stringify(response.data.student));

        navigate("/student");
      } else {
        setMessage("Invalid user role");
      }
    } catch (error) {
      setMessage(error.response?.data?.error || "Invalid access code");
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // BACK TO MAIN LOGIN
  // =========================
  const handleBackToLogin = () => {
    setLoginType("username");
    setUsername("");
    setPassword("");
    setValue("");
    setAccessCode("");
    setCodeSent(false);
    setMessage("");
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {!codeSent && loginType === "username" && (
          <>
            <h1>Sign In</h1>

            <p className="login-subtitle">Sign in with your username and password</p>

            <form
              className="login-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleUsernameLogin();
              }}
            >
              <label>Username</label>

              <input
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />

              <label>Password</label>

              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />

              <button type="submit" className="login-button" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <div className="login-divider">
              <span>or</span>
            </div>

            <div className="alternative-login">
              <button
                onClick={() => {
                  setLoginType("phone");
                  setMessage("");
                }}
              >
                Login with Phone
              </button>

              <button
                onClick={() => {
                  setLoginType("email");
                  setMessage("");
                }}
              >
                Login with Email
              </button>
            </div>
          </>
        )}

        {!codeSent && loginType !== "username" && (
          <>
            <button className="back-button" onClick={handleBackToLogin}>
              ← Back
            </button>

            <h1>Sign In</h1>

            <p className="login-subtitle">
              {loginType === "phone" ? "Please enter your phone to sign in" : "Please enter your email to sign in"}
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendCode();
              }}
            >
              <input
                type={loginType === "email" ? "email" : "text"}
                placeholder={loginType === "email" ? "Your Email Address" : "Your Phone Number"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />

              <button type="submit" className="login-button" disabled={loading}>
                {loading ? "Sending..." : "Next"}
              </button>
            </form>
          </>
        )}

        {codeSent && (
          <>
            <button
              className="back-button"
              onClick={() => {
                setCodeSent(false);
                setAccessCode("");
                setMessage("");
              }}
            >
              ← Back
            </button>

            <h1>{loginType === "phone" ? "Phone verification" : "Email verification"}</h1>

            <p className="login-subtitle">
              Please enter the code sent to your {loginType === "phone" ? "phone" : "email"}
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleVerifyCode();
              }}
            >
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="Enter your code"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
              />

              <button type="submit" className="login-button" disabled={loading}>
                {loading ? "Verifying..." : "Submit"}
              </button>
            </form>

            <p className="resend-text">
              Code not received? <button onClick={handleSendCode}>Send again</button>
            </p>
          </>
        )}

        {message && <p className="login-message">{message}</p>}
      </div>
    </div>
  );
}

export default Login;
