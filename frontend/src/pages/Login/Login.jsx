import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MdOutlineDescription } from "react-icons/md";
import axiosInstance from "../../utils/axiosinstance";
import PasswordInput from "../../components/Input/PasswordInput";
import { validateEmail } from "../../utils/helper";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const nextErrors = {
      email: validateEmail(email),
      password: password ? "" : "Please enter your password.",
    };
    setFieldErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;

    setIsSubmitting(true);
    try {
      const response = await axiosInstance.post("/login", {
        email: email.trim(),
        password,
      });
      localStorage.setItem("token", response.data.accessToken);
      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      const responseData = requestError.response?.data;
      if (responseData?.fields) {
        setFieldErrors((current) => ({ ...current, ...responseData.fields }));
      } else {
        setError(responseData?.message || "Sign-in failed. Please check your connection and try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-showcase">
        <a className="brand" href="/login">
          <span className="brand-mark"><MdOutlineDescription size={22} /></span>
          NOTES
        </a>
        <div className="showcase-message">
          <h1>Welcome<br />back.</h1>
          <p>Everything you wrote down is exactly where you left it.</p>
        </div>
        <span className="showcase-footer">A little space for everything on your mind.</span>
      </section>

      <section className="login-panel">
        <div className="login-form">
          <h2>Sign in</h2>
          <p className="login-subtitle">Use your email and password to pick up where you stopped.</p>
          {error && <p className="auth-error" role="alert">{error}</p>}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-field">
              <label htmlFor="login-email">Email address</label>
              <input
                id="login-email"
                name="email"
                className="auth-input"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (error) setError("");
                  setFieldErrors((current) => ({ ...current, email: "" }));
                }}
                onBlur={() => setFieldErrors((current) => ({ ...current, email: validateEmail(email) }))}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
              />
              {fieldErrors.email && <p className="field-error" id="login-email-error">{fieldErrors.email}</p>}
            </div>

            <div className="form-field">
              <div className="form-field-head">
                <label htmlFor="login-password">Password</label>
                <Link
                  className="field-link"
                  to={email.trim()
                    ? `/forgot-password?email=${encodeURIComponent(email.trim())}`
                    : "/forgot-password"}
                >
                  Forgot password?
                </Link>
              </div>
              <PasswordInput
                id="login-password"
                name="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                password={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) setError("");
                  setFieldErrors((current) => ({ ...current, password: "" }));
                }}
                onBlur={() => setFieldErrors((current) => ({
                  ...current,
                  password: password ? "" : "Please enter your password.",
                }))}
                invalid={Boolean(fieldErrors.password)}
                describedBy={fieldErrors.password ? "login-password-error" : undefined}
              />
              {fieldErrors.password && (
                <p className="field-error" id="login-password-error">{fieldErrors.password}</p>
              )}
            </div>

            <button className="auth-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="auth-switch">
            New here? <Link to="/signup">Create an account</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
