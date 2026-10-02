import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MdOutlineDescription } from "react-icons/md";
import axiosInstance from "../../utils/axiosinstance";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const finishLogin = (response) => {
    localStorage.setItem("token", response.data.accessToken);
    navigate("/dashboard", { replace: true });
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const response = await axiosInstance.post("/login", { email, password });
      finishLogin(response);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Sign-in failed. Please check your connection and try again.");
    }
  };

  return (
    <main className="login-page">
      <section className="login-showcase">
        <a className="brand" href="/">
          <span className="brand-mark"><MdOutlineDescription size={22} /></span>
          memo
        </a>
        <div className="showcase-message">
          <h1>Make room<br />for your ideas.</h1>
          <p>Your thoughts, plans, and little sparks of inspiration — all in one calm place.</p>
        </div>
        <span className="showcase-footer">A little space for everything on your mind.</span>
      </section>

      <section className="login-panel">
        <div className="login-form">
          <h2>Welcome back</h2>
          <p className="login-subtitle">Sign in to pick up where you left off.</p>

          {error && <p className="auth-error" role="alert">{error}</p>}

          <form onSubmit={handleLogin}>
            <label className="form-field">
              <span>Email address</span>
              <input
                className="auth-input"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label className="form-field">
              <span>Password</span>
              <input
                className="auth-input"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <button className="auth-submit" type="submit">Sign in</button>
          </form>

          <p className="auth-switch">
            New to Memo? <Link to="/signup">Create an account</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
