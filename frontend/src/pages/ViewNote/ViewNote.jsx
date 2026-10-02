import { MdClose } from "react-icons/md";

const ViewNote = ({ note, onCloseNote }) => {
  return (
    note && (
      <div className="note-dialog relative" style={{ "--note-color": note.labelColor || "#F9FBFC" }}>
        <button
          onClick={onCloseNote}
          className="icon-button absolute top-4 right-4"
          aria-label="Close note"
          type="button"
        >
          <MdClose size={24} />
        </button>
        <h2>{note.title}</h2>
        <p className="note-date mb-5">
          Updated {new Date(note.updatedAt || note.createdAt).toLocaleDateString()}
        </p>
        {note.label && <span className="note-label mb-4">{note.label}</span>}
        {note.reminderAt && (
          <p className="reminder-chip mb-4">
            Reminder: {new Date(note.reminderAt).toLocaleString()}
          </p>
        )}
        <div className="view-content">
          {note.content}
        </div>
        {note.tags && note.tags.length > 0 && (
          <div className="tag-list mt-5">
            {note.tags.map((tag, index) => (
              <span key={index} className="tag-chip">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    )
  );
};

export default ViewNote;
