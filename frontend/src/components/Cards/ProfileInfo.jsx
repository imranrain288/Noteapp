import { MdDarkMode, MdLightMode } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { getInitials } from "../../utils/helper";

export default function ProfileInfo({ userInfo, theme, onToggleTheme }) {
  const navigate = useNavigate();
  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  };
  const fullName = userInfo
    ? [userInfo.firstName, userInfo.lastName].filter(Boolean).join(" ") || userInfo.email
    : "";
  const initials = getInitials(fullName) || userInfo?.email?.slice(0, 1).toUpperCase();

  return (
    <div className="profile-menu">
      {userInfo ? (
        <>
          <div className="profile-avatar">{initials}</div>
          <div className="profile-copy">
            <strong>{fullName}</strong>
            <span>{userInfo.email}</span>
          </div>
        </>
      ) : (
        <div className="profile-avatar" aria-label="Loading profile">…</div>
      )}
      <button
        className="theme-toggle"
        onClick={onToggleTheme}
        type="button"
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      >
        {theme === "dark" ? <MdLightMode size={19} /> : <MdDarkMode size={19} />}
        <span>{theme === "dark" ? "Light" : "Dark"}</span>
      </button>
      <button className="logout-button" onClick={handleLogout} type="button">Log out</button>
    </div>
  );
}
