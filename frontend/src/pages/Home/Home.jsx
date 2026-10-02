import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MdAdd,
  MdDeleteOutline,
  MdLightbulbOutline,
  MdLabelOutline,
  MdOutlineDescription,
  MdOutlinePushPin,
} from "react-icons/md";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar/Navbar";
import NoteCard from "../../components/Cards/NoteCard";
import AddEditNote from "../AddEditNote/AddEditNote";
import axiosInstance from "../../utils/axiosinstance";
import Toast from "../../components/Toasts/Toast";
import ViewNote from "../ViewNote/ViewNote";

const sections = [
  { id: "notes", label: "All notes", icon: MdOutlineDescription },
  { id: "pinned", label: "Pinned", icon: MdOutlinePushPin },
  { id: "trash", label: "Trash", icon: MdDeleteOutline },
];

export default function Home() {
  const [theme, setTheme] = useState(() => localStorage.getItem("memo-theme") === "dark" ? "dark" : "light");
  const [view, setView] = useState("notes");
  const [selectedLabel, setSelectedLabel] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [notes, setNotes] = useState([]);
  const [userInfo, setUserInfo] = useState(null);
  const [isNoteEditorOpen, setIsNoteEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [viewingNote, setViewingNote] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState({ isShown: false, message: "", type: "add" });
  const navigate = useNavigate();

  const showToast = useCallback((message, type = "add") => {
    setToast({ isShown: true, message, type });
    window.setTimeout(() => setToast((current) => ({ ...current, isShown: false })), 2600);
  }, []);

  useEffect(() => {
    localStorage.setItem("memo-theme", theme);
  }, [theme]);

  const refreshNotes = () => setRefreshKey((key) => key + 1);

  useEffect(() => {
    let cancelled = false;
    const loadNotes = async () => {
      try {
        const query = searchQuery.trim();
        const path = view === "trash"
          ? `/get-trash${query ? `?q=${encodeURIComponent(query)}` : ""}`
          : query
            ? `/search?q=${encodeURIComponent(query)}`
            : "/get-notes";
        const response = await axiosInstance.get(path);
        if (!cancelled) {
          setNotes(response.data.notes || []);
          setLoadError("");
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error.response?.data?.message || "We couldn't load your notes. Please try again.");
        }
      }
    };

    const timeout = window.setTimeout(loadNotes, searchQuery.trim() ? 250 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [view, searchQuery, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    axiosInstance.get("/user")
      .then((response) => {
        if (!cancelled) setUserInfo(response.data.user);
      })
      .catch((error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
          localStorage.removeItem("token");
          navigate("/login", { replace: true });
          return;
        }
        if (!cancelled) setLoadError("We couldn't load your profile. Please try signing in again.");
      });

    return () => { cancelled = true; };
  }, [navigate]);

  const displayedNotes = useMemo(() => {
    let visibleNotes = view === "pinned" ? notes.filter((note) => note.isPinned) : notes;
    if (selectedLabel && view !== "trash") {
      visibleNotes = visibleNotes.filter((note) => note.label?.trim() === selectedLabel);
    }
    return visibleNotes;
  }, [notes, selectedLabel, view]);
  const pinnedCount = notes.filter((note) => note.isPinned).length;
  const labels = useMemo(() => {
    const byName = new Map();
    notes.forEach((note) => {
      if (note.label?.trim()) byName.set(note.label.trim(), note.labelColor || "#F9FBFC");
    });
    return [...byName.entries()].sort(([first], [second]) => first.localeCompare(second));
  }, [notes]);

  useEffect(() => {
    if (!userInfo?._id) return undefined;

    const storageKey = `memo-fired-reminders-${userInfo._id}`;
    let notified = new Set();
    try {
      notified = new Set(JSON.parse(localStorage.getItem(storageKey) || "[]"));
    } catch (error) {
      console.error("Could not load reminder notification history:", error);
    }

    let checking = false;
    const checkReminders = async () => {
      if (checking) return;
      checking = true;
      try {
        const response = await axiosInstance.get("/get-notes");
        const now = Date.now();
        for (const note of response.data.notes || []) {
          if (!note.reminderAt || new Date(note.reminderAt).getTime() > now) continue;
          const reminderId = `${note._id}:${note.reminderAt}`;
          if (notified.has(reminderId)) continue;

          notified.add(reminderId);
          try {
            localStorage.setItem(storageKey, JSON.stringify([...notified]));
          } catch (error) {
            console.error("Could not save reminder notification history:", error);
          }

          if ("Notification" in window && Notification.permission === "granted") {
            try {
              const notification = new Notification(`Memo reminder: ${note.title}`, {
                body: note.content.slice(0, 180),
                tag: reminderId,
              });
              notification.onclick = () => {
                window.focus();
                notification.close();
              };
            } catch (error) {
              console.error("Could not show reminder notification:", error);
              showToast(`Reminder: ${note.title}`);
            }
          } else {
            showToast(`Reminder: ${note.title}`);
          }
        }
      } catch (error) {
        console.error("Could not check note reminders:", error);
      } finally {
        checking = false;
      }
    };

    checkReminders();
    const interval = window.setInterval(checkReminders, 15000);
    window.addEventListener("focus", checkReminders);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", checkReminders);
    };
  }, [userInfo?._id, showToast]);

  const shareNote = async (note, platform) => {
    const keywords = note.tags?.length ? `\n\nKeywords: ${note.tags.join(", ")}` : "";
    const text = `${note.title}\n\n${note.content}${keywords}`;
    const encodedText = encodeURIComponent(text);
    const shareUrls = {
      whatsapp: `https://wa.me/?text=${encodedText}`,
      x: `https://twitter.com/intent/tweet?text=${encodedText}`,
      bluesky: `https://bsky.app/intent/compose?text=${encodedText}`,
      reddit: `https://www.reddit.com/submit?title=${encodeURIComponent(note.title)}&text=${encodedText}`,
      email: `mailto:?subject=${encodeURIComponent(note.title)}&body=${encodedText}`,
    };

    if (platform === "copy") {
      try {
        await navigator.clipboard.writeText(text);
        showToast("Note copied to clipboard");
      } catch {
        showToast("Clipboard access is unavailable in this browser", "delete");
      }
      return;
    }

    if (platform === "native" && navigator.share) {
      try {
        await navigator.share({ title: note.title, text });
      } catch (error) {
        if (error.name !== "AbortError") showToast("Couldn't share this note", "delete");
      }
      return;
    }

    const shareUrl = shareUrls[platform];
    if (shareUrl) window.open(shareUrl, "_blank", "noopener,noreferrer");
  };

  const updatePin = async (note) => {
    try {
      await axiosInstance.put(`/pin-note/${note._id}`);
      refreshNotes();
      showToast(note.isPinned ? "Note unpinned" : "Note pinned");
    } catch (error) {
      showToast(error.response?.data?.message || "Couldn't update pin", "delete");
    }
  };

  const moveToTrash = async (note) => {
    try {
      await axiosInstance.delete(`/delete-note/${note._id}`);
      refreshNotes();
      showToast("Note moved to trash", "delete");
    } catch (error) {
      showToast(error.response?.data?.message || "Couldn't move note to trash", "delete");
    }
  };

  const restoreNote = async (note) => {
    try {
      await axiosInstance.put(`/restore-note/${note._id}`);
      refreshNotes();
      showToast("Note restored");
    } catch (error) {
      showToast(error.response?.data?.message || "Couldn't restore note", "delete");
    }
  };

  const permanentlyDeleteNote = async (note) => {
    if (!window.confirm(`Permanently delete "${note.title}"? This can't be undone.`)) return;
    try {
      await axiosInstance.delete(`/permanent-delete-note/${note._id}`);
      refreshNotes();
      showToast("Note permanently deleted", "delete");
    } catch (error) {
      showToast(error.response?.data?.message || "Couldn't delete note", "delete");
    }
  };

  const heading = {
    notes: selectedLabel
      ? [selectedLabel, `Notes labeled ${selectedLabel}.`]
      : ["Your notes", "A clear mind starts with getting it all down."],
    pinned: ["Pinned notes", "Keep your most important thoughts close."],
    trash: ["Trash", "Restore notes or permanently remove them."],
  }[view];

  return (
    <div className="app-shell" data-theme={theme}>
      <Navbar
        userInfo={userInfo}
        searchQuery={searchQuery}
        onSearchChange={(event) => setSearchQuery(event.target.value)}
        theme={theme}
        onToggleTheme={() => setTheme((current) => current === "light" ? "dark" : "light")}
      />

      <div className="dashboard-layout">
        <aside className="sidebar" aria-label="Notes navigation">
          <span className="sidebar-label">Workspace</span>
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${view === id ? "active" : ""}`}
              onClick={() => { setView(id); setSelectedLabel(""); }}
              type="button"
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === "pinned" && <span className="nav-count">{pinnedCount}</span>}
              {id === "notes" && <span className="nav-count">{notes.length}</span>}
            </button>
          ))}
          {labels.length > 0 && (
            <>
              <span className="sidebar-label">Labels</span>
              {labels.map(([label, color]) => (
                <button
                  key={label}
                  className={`nav-item sidebar-category ${selectedLabel === label ? "active" : ""}`}
                  onClick={() => { setView("notes"); setSelectedLabel(label); }}
                  type="button"
                >
                  <MdLabelOutline size={18} />
                  <span>{label}</span>
                  <span className="category-color-dot" style={{ "--category-color": color }} />
                </button>
              ))}
            </>
          )}
          <div className="sidebar-tip">
            <strong><MdLightbulbOutline size={15} /> A little tip</strong>
            Add keywords to your notes so they are easy to find later.
          </div>
        </aside>

        <main className="main-content">
          <div className="page-heading">
            <div>
              <h1>{heading[0]}</h1>
              <p>{heading[1]}</p>
            </div>
            {view !== "trash" && (
              <button
                className="primary-button"
                onClick={() => { setEditingNote(null); setIsNoteEditorOpen(true); }}
                type="button"
              >
                <MdAdd size={18} /> New note
              </button>
            )}
          </div>

          {loadError && <div className="error-banner" role="alert">{loadError}</div>}

          <div className="notes-toolbar">
            <span>{displayedNotes.length} {displayedNotes.length === 1 ? "note" : "notes"}</span>
            {searchQuery.trim() && <span>Search results for “{searchQuery.trim()}”</span>}
          </div>

          {displayedNotes.length ? (
            <div className="notes-grid">
              {displayedNotes.map((note) => (
                <NoteCard
                  key={note._id}
                  title={note.title}
                  date={new Date(note.updatedAt || note.createdAt).toLocaleDateString()}
                  content={note.content}
                  tags={note.tags || []}
                  label={note.label}
                  labelColor={note.labelColor}
                  reminderAt={note.reminderAt}
                  isPinned={note.isPinned}
                  isTrashed={view === "trash"}
                  onEdit={() => { setEditingNote(note); setIsNoteEditorOpen(true); }}
                  onPinNote={() => updatePin(note)}
                  onDelete={() => moveToTrash(note)}
                  onRestore={() => restoreNote(note)}
                  onPermanentDelete={() => permanentlyDeleteNote(note)}
                  onShare={(platform) => { void shareNote(note, platform); }}
                  onClick={() => setViewingNote(note)}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">
                {view === "trash" ? <MdDeleteOutline /> : <MdOutlineDescription />}
              </div>
              <h2>
                {searchQuery.trim()
                  ? "No matching notes"
                  : view === "trash"
                    ? "Trash is empty"
                    : view === "pinned"
                      ? "No pinned notes yet"
                      : "Your ideas start here"}
              </h2>
              <p>
                {searchQuery.trim()
                  ? "Try another keyword or check your spelling."
                  : view === "trash"
                    ? "Notes you move to trash will show up here."
                    : view === "pinned"
                      ? "Pin a note to keep it at the top of your workspace."
                      : "Create a note to capture a thought, a plan, or anything worth remembering."}
              </p>
            </div>
          )}
        </main>
      </div>

      {isNoteEditorOpen && (
        <AddEditNote
          type={editingNote ? "edit" : "add"}
          noteData={editingNote}
          onClose={() => setIsNoteEditorOpen(false)}
          getAllNotes={refreshNotes}
          showToast={showToast}
        />
      )}

      {viewingNote && (
        <div className="modal-overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setViewingNote(null);
        }}>
          <ViewNote note={viewingNote} onCloseNote={() => setViewingNote(null)} />
        </div>
      )}

      <Toast
        isShown={toast.isShown}
        message={toast.message}
        type={toast.type}
      />
    </div>
  );
}
