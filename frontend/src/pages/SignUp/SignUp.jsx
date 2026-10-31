import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MdOutlineDescription } from "react-icons/md";
import axiosInstance from "../../utils/axiosinstance";
import PasswordInput from "../../components/Input/PasswordInput";
import {
  PASSWORD_MIN_LENGTH,
  passwordChecks,
  validateEmail,
  validateName,
  validatePassword,
} from "../../utils/helper";

const EMAIL_CHECK_DELAY_MS = 450;

export default function SignUp() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [emailStatus, setEmailStatus] = useState({ state: "idle", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Availability is checked once typing pauses, and the in-flight request is
  // aborted on the next keystroke so a stale answer cannot overwrite a newer one.
  useEffect(() => {
    const value = email.trim();
    setEmailStatus({ state: "idle", message: "" });

    if (!value || validateEmail(value)) {
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await axiosInstance.post(
          "/check-email",
          { email: value },
          { signal: controller.signal },
        );
        if (response.data?.available) {
          setEmailStatus({ state: "available", message: "This email is available." });
        } else {
          setEmailStatus({
            state: "taken",
            message: response.data?.message || "An account with this email already exists.",
          });
        }
      } catch (requestError) {
        if (requestError.code === "ERR_CANCELED") return;
        setEmailStatus({ state: "idle", message: "" });
      }
    }, EMAIL_CHECK_DELAY_MS);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [email]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const nextErrors = {
      firstName: validateName(firstName, "First name"),
      lastName: validateName(lastName, "Last name"),
      email: validateEmail(email),
      password: validatePassword(password),
      confirmPassword: confirmPassword === password ? "" : "Passwords do not match.",
    };
    setFieldErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    if (emailStatus.state === "taken") {
      setFieldErrors((current) => ({ ...current, email: emailStatus.message }));
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await axiosInstance.post("/create-user", {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
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
        setError(responseData?.message || "Couldn't create your account. Please try again.");
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

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="signup-first-name">First name</label>
                <input
                  id="signup-first-name"
                  name="firstName"
                  className="auth-input"
                  autoComplete="given-name"
                  placeholder="Imran"
                  value={firstName}
                  onChange={(event) => {
                    setFirstName(event.target.value);
                    if (error) setError("");
                    setFieldErrors((current) => ({ ...current, firstName: "" }));
                  }}
                  onBlur={() => setFieldErrors((current) => ({
                    ...current,
                    firstName: validateName(firstName, "First name"),
                  }))}
                  aria-invalid={Boolean(fieldErrors.firstName)}
                  aria-describedby={fieldErrors.firstName ? "signup-first-name-error" : undefined}
                />
                {fieldErrors.firstName && (
                  <p className="field-error" id="signup-first-name-error">{fieldErrors.firstName}</p>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="signup-last-name">Last name</label>
                <input
                  id="signup-last-name"
                  name="lastName"
                  className="auth-input"
                  autoComplete="family-name"
                  placeholder="Rain"
                  value={lastName}
                  onChange={(event) => {
                    setLastName(event.target.value);
                    if (error) setError("");
                    setFieldErrors((current) => ({ ...current, lastName: "" }));
                  }}
                  onBlur={() => setFieldErrors((current) => ({
                    ...current,
                    lastName: validateName(lastName, "Last name"),
                  }))}
                  aria-invalid={Boolean(fieldErrors.lastName)}
                  aria-describedby={fieldErrors.lastName ? "signup-last-name-error" : undefined}
                />
                {fieldErrors.lastName && (
                  <p className="field-error" id="signup-last-name-error">{fieldErrors.lastName}</p>
                )}
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="signup-email">Email address</label>
              <input
                id="signup-email"
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
                aria-describedby={fieldErrors.email ? "signup-email-error" : undefined}
              />
              {fieldErrors.email ? (
                <p className="field-error" id="signup-email-error">{fieldErrors.email}</p>
              ) : (
                emailStatus.state === "available" && <p className="field-hint success">{emailStatus.message}</p>
              )}
              {!fieldErrors.email && (emailStatus.state === "taken" || emailStatus.state === "checking") && (
                <p className="field-hint">{emailStatus.message}</p>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="signup-password">Password</label>
              <PasswordInput
                id="signup-password"
                name="password"
                autoComplete="new-password"
                placeholder="Create a password"
                password={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) setError("");
                  setFieldErrors((current) => ({ ...current, password: "" }));
                }}
                onBlur={() => setFieldErrors((current) => ({ ...current, password: validatePassword(password) }))}
                invalid={Boolean(fieldErrors.password)}
                describedBy={fieldErrors.password ? "signup-password-error" : "signup-password-hint"}
              />
              {fieldErrors.password ? (
                <p className="field-error" id="signup-password-error">{fieldErrors.password}</p>
              ) : (
                <ul className="password-hint" id="signup-password-hint">
                  {passwordChecks(password).map((check) => (
                    <li key={check.label} className={check.met ? "met" : ""}>
                      {check.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="signup-confirm-password">Confirm password</label>
              <PasswordInput
                id="signup-confirm-password"
                name="confirmPassword"
                autoComplete="new-password"
                placeholder="Re-enter your password"
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
                describedBy={fieldErrors.confirmPassword ? "signup-confirm-password-error" : undefined}
              />
              {fieldErrors.confirmPassword && (
                <p className="field-error" id="signup-confirm-password-error">{fieldErrors.confirmPassword}</p>
              )}
            </div>

            <button className="auth-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
