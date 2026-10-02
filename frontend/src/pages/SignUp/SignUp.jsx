import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MdOutlineDescription } from "react-icons/md";
import axiosInstance from "../../utils/axiosinstance";
import { validEmail } from "../../utils/helper";

export default function SignUp() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const finishLogin = (response) => {
    localStorage.setItem("token", response.data.accessToken);
    navigate("/dashboard", { replace: true });
  };

  const handleSignUp = async (event) => {
    event.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      setError("Please complete every field.");
      return;
    }
    if (!validEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setError("");
    try {
      const response = await axiosInstance.post("/create-user", {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
      });
      finishLogin(response);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Couldn't create your account. Please try again.");
    }
  };

  return (
    <main className="login-page">
      <section className="login-showcase">
        <a className="brand" href="/login">
          <span className="brand-mark"><MdOutlineDescription size={22} /></span>
          memo
        </a>
        <div className="showcase-message">
          <h1>Your next<br />great thought<br />starts here.</h1>
          <p>Make a little space for the ideas you don&apos;t want to lose.</p>
        </div>
        <span className="showcase-footer">A little space for everything on your mind.</span>
      </section>

      <section className="login-panel">
        <div className="login-form">
          <h2>Create your account</h2>
          <p className="login-subtitle">Start collecting your ideas in one place.</p>
          {error && <p className="auth-error" role="alert">{error}</p>}

          <form onSubmit={handleSignUp}>
            <label className="form-field">
              <span>First name</span>
              <input className="auth-input" value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" required />
            </label>
            <label className="form-field">
              <span>Last name</span>
              <input className="auth-input" value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" required />
            </label>
            <label className="form-field">
              <span>Email address</span>
              <input className="auth-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
            </label>
            <label className="form-field">
              <span>Password</span>
              <input className="auth-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required />
            </label>
            <button className="auth-submit" type="submit">Create account</button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
