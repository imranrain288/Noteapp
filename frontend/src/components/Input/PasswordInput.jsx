import { useState } from "react";

import { FaRegEye, FaRegEyeSlash } from "react-icons/fa6";

export default function PasswordInput({
  password,
  onChange,
  onBlur,
  placeholder = "Password",
  id,
  name,
  autoComplete,
  inputClassName = "auth-input",
  describedBy,
  invalid = false,
}) {
  const [showPass, setShowPass] = useState(false);

  return (
    <div className="password-field">
      <input
        id={id}
        name={name}
        type={showPass ? "text" : "password"}
        value={password}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={inputClassName}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
      />

      <button
        type="button"
        className="password-toggle"
        aria-label={showPass ? "Hide password" : "Show password"}
        aria-pressed={showPass}
        onClick={() => setShowPass((current) => !current)}
      >
        {showPass ? <FaRegEye size={19} /> : <FaRegEyeSlash size={19} />}
      </button>
    </div>
  );
}
