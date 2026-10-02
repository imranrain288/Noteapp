import { useState } from "react";
import {
  MdContentCopy,
  MdCreate,
  MdDeleteOutline,
  MdNotificationsActive,
  MdOutlineMail,
  MdOutlinePushPin,
  MdRestore,
  MdShare,
} from "react-icons/md";

export default function NoteCard({
  title,
  date,
  content,
  tags = [],
  label = "",
  labelColor = "#F9FBFC",
  reminderAt,
  isPinned,
  isTrashed,
  onEdit,
  onDelete,
  onPinNote,
  onRestore,
  onPermanentDelete,
  onShare,
  onClick,
}) {
  const [shareMenuOpen, setShareMenuOpen] = useState(false);

  const stopAndRun = (event, callback) => {
    event.stopPropagation();
    callback?.();
  };

  return (
    <article className="note-card" style={{ "--note-color": labelColor }} onClick={onClick}>
      <div className="note-card-header">
        <div>
          <h2>{title}</h2>
          <span className="note-date">{isTrashed ? "Updated" : "Edited"} {date}</span>
          {label && <span className="note-label">{label}</span>}
        </div>
        {!isTrashed && (
          <button
            className={`icon-button ${isPinned ? "pinned" : ""}`}
            onClick={(event) => stopAndRun(event, onPinNote)}
            aria-label={isPinned ? "Unpin note" : "Pin note"}
            title={isPinned ? "Unpin note" : "Pin note"}
            type="button"
          >
            <MdOutlinePushPin size={18} />
          </button>
        )}
      </div>

      <p className="note-preview">{content}</p>

      <div className="note-card-footer">
        <div className="tag-list">
          {tags.slice(0, 4).map((tag) => <span className="tag-chip" key={tag}>#{tag}</span>)}
          {tags.length > 4 && <span className="tag-chip">+{tags.length - 4}</span>}
          {!isTrashed && reminderAt && (
            <span className="reminder-chip" title={`Reminder: ${new Date(reminderAt).toLocaleString()}`}>
              <MdNotificationsActive size={13} />
              {new Date(reminderAt).toLocaleString()}
            </span>
          )}
        </div>
        <div className="note-actions">
          {isTrashed ? (
            <>
              <button
                className="icon-button"
                onClick={(event) => stopAndRun(event, onRestore)}
                aria-label="Restore note"
                title="Restore"
                type="button"
              >
                <MdRestore size={18} />
              </button>
              <button
                className="icon-button"
                onClick={(event) => stopAndRun(event, onPermanentDelete)}
                aria-label="Permanently delete note"
                title="Delete forever"
                type="button"
              >
                <MdDeleteOutline size={18} />
              </button>
            </>
          ) : (
            <>
              <div className="share-menu-wrap">
                <button
                  className="icon-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShareMenuOpen((open) => !open);
                  }}
                  aria-label="Share note"
                  aria-expanded={shareMenuOpen}
                  title="Share note"
                  type="button"
                >
                  <MdShare size={18} />
                </button>
                {shareMenuOpen && (
                  <div className="share-menu" onClick={(event) => event.stopPropagation()}>
                    {typeof navigator !== "undefined" && navigator.share && (
                      <button type="button" onClick={() => { onShare("native"); setShareMenuOpen(false); }}>
                        <MdShare size={16} /> Share…
                      </button>
                    )}
                    <button type="button" onClick={() => { onShare("whatsapp"); setShareMenuOpen(false); }}>
                      <span className="share-platform-icon">WA</span> WhatsApp
                    </button>
                    <button type="button" onClick={() => { onShare("x"); setShareMenuOpen(false); }}>
                      <span className="share-platform-icon">X</span> X
                    </button>
                    <button type="button" onClick={() => { onShare("bluesky"); setShareMenuOpen(false); }}>
                      <span className="share-platform-icon">b</span> Bluesky
                    </button>
                    <button type="button" onClick={() => { onShare("reddit"); setShareMenuOpen(false); }}>
                      <span className="share-platform-icon">r/</span> Reddit
                    </button>
                    <button type="button" onClick={() => { onShare("email"); setShareMenuOpen(false); }}>
                      <MdOutlineMail size={16} /> Email
                    </button>
                    <button type="button" onClick={() => { onShare("copy"); setShareMenuOpen(false); }}>
                      <MdContentCopy size={16} /> Copy text
                    </button>
                  </div>
                )}
              </div>
              <button
                className="icon-button"
                onClick={(event) => stopAndRun(event, onEdit)}
                aria-label="Edit note"
                title="Edit"
                type="button"
              >
                <MdCreate size={17} />
              </button>
              <button
                className="icon-button"
                onClick={(event) => stopAndRun(event, onDelete)}
                aria-label="Move note to trash"
                title="Move to trash"
                type="button"
              >
                <MdDeleteOutline size={18} />
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
