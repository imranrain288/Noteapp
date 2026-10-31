import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MdOutlineDescription } from "react-icons/md";
import axiosInstance from "../../utils/axiosinstance";
import { validateEmail } from "../../utils/helper";

export default function ForgotPassword() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [fieldError, setFieldError] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sentMessage, setSentMessage] = useState("");
  const [resetUrl, setResetUrl] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const emailError = validateEmail(email);
    setFieldError(emailError);
    if (emailError) return;

    setIsSubmitting(true);
    try {
      const response = await axiosInstance.post("/forgot-password", { email: email.trim() });
      setSentMessage(response.data?.message || "If an account exists for that email, a reset link has been created.");
      setResetUrl(response.data?.resetUrl || "");
    } catch (requestError) {
      const responseData = requestError.response?.data;
      if (responseData?.fields?.email) {
        setFieldError(responseData.fields.email);
      } else {
        setError(responseData?.message || "Couldn't start the reset. Please check your connection and try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const startOver = () => {
    setSentMessage("");
    setResetUrl("");
    setError("");
  };

  // The API builds the link against the frontend origin; only the path is needed
  // to keep navigation inside the app.
  let resetPath = "";
  if (resetUrl) {
    try {
      resetPath = new URL(resetUrl).pathname;
    } catch {
      resetPath = "";
    }
  }

  return (
    <main className="login-page">
      <section className="login-showcase">
        <a className="brand" href="/login">
          <span className="brand-mark"><MdOutlineDescription size={22} /></span>
          NOTES
        </a>
        <div className="showcase-message">
          <h1>Locked out?<br />Let&apos;s fix that.</h1>
          <p>We&apos;ll email a one-time link so you can choose a new password and get back to your notes.</p>
        </div>
        <span className="showcase-footer">A little space for everything on your mind.</span>
      </section>

      <section className="login-panel">
        <div className="login-form">
          {sentMessage ? (
            <>
              <h2>Check your inbox</h2>
              <p className="login-subtitle">{sentMessage}</p>

              {resetPath && (
                <p className="auth-info" role="status">
                  This server could not send the email, so open the link directly:{" "}
                  <Link className="auth-link-strong" to={resetPath}>Open reset link</Link>
                </p>
              )}

              <div className="auth-actions">
                <Link className="auth-submit auth-submit-link" to="/login">Back to sign in</Link>
                <button className="auth-secondary" type="button" onClick={startOver}>Use a different email</button>
              </div>
            </>
          ) : (
            <>
              <h2>Forgot password</h2>
              <p className="login-subtitle">Enter the email on your account and we&apos;ll send you a reset link.</p>
              {error && <p className="auth-error" role="alert">{error}</p>}

              <form onSubmit={handleSubmit} noValidate>
                <div className="form-field">
                  <label htmlFor="forgot-email">Email address</label>
                  <input
                    id="forgot-email"
                    name="email"
                    className="auth-input"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (error) setError("");
                      if (fieldError) setFieldError("");
                    }}
                    onBlur={() => setFieldError(validateEmail(email))}
                    aria-invalid={Boolean(fieldError)}
                    aria-describedby={fieldError ? "forgot-email-error" : undefined}
                  />
                  {fieldError && <p className="field-error" id="forgot-email-error">{fieldError}</p>}
                </div>

                <button className="auth-submit" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Sending…" : "Send reset link"}
                </button>
              </form>

              <p className="auth-switch">
                Remembered it? <Link to="/login">Back to sign in</Link>
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
