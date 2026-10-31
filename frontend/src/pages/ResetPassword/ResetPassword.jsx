import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MdOutlineDescription } from "react-icons/md";
import axiosInstance from "../../utils/axiosinstance";
import PasswordInput from "../../components/Input/PasswordInput";
import { PASSWORD_MIN_LENGTH, passwordChecks, validatePassword } from "../../utils/helper";

const STATUS = {
  CHECKING: "checking",
  READY: "ready",
  INVALID: "invalid",
  DONE: "done",
};

export default function ResetPassword() {
  const { token } = useParams();
  const [status, setStatus] = useState(STATUS.CHECKING);
  const [statusMessage, setStatusMessage] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isActive = true;

    axiosInstance.get(`/verify-reset-token/${encodeURIComponent(token || "")}`)
      .then(() => {
        if (isActive) setStatus(STATUS.READY);
      })
      .catch((requestError) => {
        if (!isActive) return;
        setStatus(STATUS.INVALID);
        setStatusMessage(requestError.response?.data?.message || "This reset link is invalid or has expired.");
      });

    return () => {
      isActive = false;
    };
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const nextErrors = {
      password: validatePassword(password),
      confirmPassword: confirmPassword === password ? "" : "Passwords do not match.",
    };
    setFieldErrors(nextErrors);
    if (nextErrors.password || nextErrors.confirmPassword) return;

    setIsSubmitting(true);
    try {
      const response = await axiosInstance.post("/reset-password", { token, password });
      setStatusMessage(response.data?.message || "Your password has been updated.");
      setStatus(STATUS.DONE);
    } catch (requestError) {
      const responseData = requestError.response?.data;
      if (responseData?.fields) {
        setFieldErrors((current) => ({ ...current, ...responseData.fields }));
      } else {
        setError(responseData?.message || "Couldn't update your password. Please request a new link.");
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
          <h1>A fresh start<br />for your password.</h1>
          <p>Pick something you don&apos;t use anywhere else, then get straight back to your notes.</p>
        </div>
        <span className="showcase-footer">A little space for everything on your mind.</span>
      </section>

      <section className="login-panel">
        <div className="login-form">
          {status === STATUS.CHECKING && (
            <>
              <h2>Checking your link</h2>
              <p className="login-subtitle" role="status">One moment while we verify this reset link.</p>
            </>
          )}

          {status === STATUS.INVALID && (
            <>
              <h2>Link expired</h2>
              <p className="auth-error" role="alert">{statusMessage}</p>
              <div className="auth-actions">
                <Link className="auth-submit auth-submit-link" to="/forgot-password">Request a new link</Link>
                <Link className="auth-secondary" to="/login">Back to sign in</Link>
              </div>
            </>
          )}

          {status === STATUS.DONE && (
            <>
              <h2>Password updated</h2>
              <p className="login-subtitle" role="status">{statusMessage}</p>
              <div className="auth-actions">
                <Link className="auth-submit auth-submit-link" to="/login">Sign in</Link>
              </div>
            </>
          )}

          {status === STATUS.READY && (
            <>
              <h2>Choose a new password</h2>
              <p className="login-subtitle">Use at least {PASSWORD_MIN_LENGTH} characters, including a letter and a number.</p>
              {error && <p className="auth-error" role="alert">{error}</p>}

              <form onSubmit={handleSubmit} noValidate>
                <div className="form-field">
                  <label htmlFor="reset-password">New password</label>
                  <PasswordInput
                    id="reset-password"
                    name="password"
                    autoComplete="new-password"
                    placeholder="Enter a new password"
                    password={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (error) setError("");
                      setFieldErrors((current) => ({ ...current, password: "" }));
                    }}
                    onBlur={() => setFieldErrors((current) => ({ ...current, password: validatePassword(password) }))}
                    invalid={Boolean(fieldErrors.password)}
                    describedBy={fieldErrors.password ? "reset-password-error" : "reset-password-hint"}
                  />
                  {fieldErrors.password ? (
                    <p className="field-error" id="reset-password-error">{fieldErrors.password}</p>
                  ) : (
                    <ul className="password-hint" id="reset-password-hint">
                      {passwordChecks(password).map((check) => (
                        <li key={check.label} className={check.met ? "met" : ""}>
                          {check.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="form-field">
                  <label htmlFor="reset-confirm-password">Confirm new password</label>
                  <PasswordInput
                    id="reset-confirm-password"
                    name="confirmPassword"
                    autoComplete="new-password"
                    placeholder="Re-enter your new password"
                    password={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      setFieldErrors((current) => ({ ...current, confirmPassword: "" }));
                    }}
                    onBlur={() => setFieldErrors((current) => ({
                      ...current,
                      confirmPassword: confirmPassword === password ? "" : "Passwords do not match.",
                    }))}
                    invalid={Boolean(fieldErrors.confirmPassword)}
                    describedBy={fieldErrors.confirmPassword ? "reset-confirm-password-error" : undefined}
                  />
                  {fieldErrors.confirmPassword && (
                    <p className="field-error" id="reset-confirm-password-error">{fieldErrors.confirmPassword}</p>
                  )}
                </div>

                <button className="auth-submit" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Updating…" : "Update password"}
                </button>
              </form>

              <p className="auth-switch">
                <Link to="/login">Back to sign in</Link>
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
