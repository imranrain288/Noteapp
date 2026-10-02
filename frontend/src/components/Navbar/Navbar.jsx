import { MdOutlineDescription, MdSearch } from "react-icons/md";
import { Link } from "react-router-dom";
import ProfileInfo from "../Cards/ProfileInfo";

export default function Navbar({
  userInfo,
  searchQuery = "",
  onSearchChange,
  theme,
  onToggleTheme,
}) {
  return (
    <header className="topbar">
      <Link className="brand" to="/dashboard" aria-label="Memo home">
        <span className="brand-mark"><MdOutlineDescription size={22} /></span>
        memo
      </Link>
      <label className="search-box">
        <MdSearch size={19} aria-hidden="true" />
        <input
          type="search"
          placeholder="Search notes, keywords, tags..."
          value={searchQuery}
          onChange={onSearchChange}
          aria-label="Search notes"
        />
      </label>
      <span className="topbar-spacer" />
      <ProfileInfo
        userInfo={userInfo}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />
    </header>
  );
}
