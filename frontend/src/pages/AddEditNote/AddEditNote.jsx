import { useState } from "react";
import { MdClose, MdNotificationsActive } from "react-icons/md";
import TagInput from "../../components/Input/TagInput";
import axiosInstance from "../../utils/axiosinstance";

const labelColors = [
  { name: "Blue", color: "#BFDBFE" },
  { name: "Green", color: "#BBF7D0" },
  { name: "Yellow", color: "#FDE68A" },
  { name: "Orange", color: "#FED7AA" },
  { name: "Pink", color: "#FBCFE8" },
  { name: "Purple", color: "#DDD6FE" },
  { name: "Red", color: "#FECACA" },
];

const toLocalDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function AddEditNote({
  onClose,
  noteData,
  type,
  getAllNotes,
  showToast,
}) {
  const [tags, setTags] = useState(noteData?.tags || []);
  const [title, setTitle] = useState(noteData?.title || "");
  const [content, setContent] = useState(noteData?.content || "");
  const [label, setLabel] = useState(noteData?.label || "");
  const [labelColor, setLabelColor] = useState(noteData?.labelColor || "#F9FBFC");
  const [reminderAt, setReminderAt] = useState(toLocalDateTime(noteData?.reminderAt));
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError("Add a title and some content before saving.");
      return;
    }

    setError("");
    if (reminderAt && "Notification" in window && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch (permissionError) {
        console.error("Could not request notification permission:", permissionError);
      }
    }
    setIsSaving(true);
    try {
      const noteDataToSave = {
        title,
        content,
        tags,
        label,
        labelColor,
        reminderAt: reminderAt ? new Date(reminderAt).toISOString() : null,
      };
      if (type === "edit") {
        await axiosInstance.post(`/edit-note/${noteData._id}`, noteDataToSave);
      } else {
        await axiosInstance.post("/create-note", noteDataToSave);
      }
      getAllNotes();
      onClose();
      showToast(type === "edit" ? "Note updated" : "Note created");
      if (reminderAt && (!("Notification" in window) || Notification.permission !== "granted")) {
        showToast("Reminder saved. Enable browser notifications to get alerts.", "delete");
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Couldn't save this note. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <form className="note-dialog" onSubmit={handleSubmit}>
        <div className="note-dialog-heading">
          <div>
            <h2>{type === "edit" ? "Edit note" : "Create a note"}</h2>
            <p>Save the details you want to remember.</p>
          </div>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close">
            <MdClose size={21} />
          </button>
        </div>

        <div className="form-field">
          <label htmlFor="note-title">Title</label>
          <input
            id="note-title"
            value={title}
            onChange={(event) => setTitle(event.target.value.slice(0, 100))}
            placeholder="Give your note a title"
            maxLength={100}
            autoFocus
          />
        </div>

        <div className="form-field">
          <label htmlFor="note-content">Content</label>
          <textarea
            id="note-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Start writing..."
            rows={7}
          />
        </div>

        <div className="form-field">
          <label htmlFor="note-keywords">Keywords</label>
          <TagInput tags={tags} setTags={setTags} />
        </div>

        <div className="form-field">
          <label htmlFor="note-label">Custom label</label>
          <input
            id="note-label"
            value={label}
            onChange={(event) => setLabel(event.target.value.slice(0, 40))}
            placeholder="e.g. Work, Personal, Ideas"
            maxLength={40}
          />
        </div>

        <div className="form-field">
          <label>Label color</label>
          <div className="label-color-options">
            {labelColors.map(({ name, color: swatch }) => (
              <button
                key={swatch}
                className={`label-color-swatch ${labelColor === swatch ? "selected" : ""}`}
                style={{ "--swatch-color": swatch }}
                onClick={() => setLabelColor(swatch)}
                type="button"
                aria-label={`${name} label color`}
                aria-pressed={labelColor === swatch}
                title={name}
              />
            ))}
            <div className="custom-color-picker">
              <span>Custom</span>
              <input
                type="color"
                value={labelColor}
                onChange={(event) => setLabelColor(event.target.value.toUpperCase())}
                aria-label="Choose custom label color"
              />
            </div>
            <button
              className={`label-color-swatch no-color ${labelColor === "#F9FBFC" ? "selected" : ""}`}
              onClick={() => setLabelColor("#F9FBFC")}
              type="button"
              aria-label="No label color"
              aria-pressed={labelColor === "#F9FBFC"}
              title="Default color"
            />
          </div>
          <span className="color-code-value">{labelColor.toUpperCase()}</span>
        </div>

        <div className="form-field">
          <label htmlFor="note-reminder"><MdNotificationsActive size={15} /> Reminder</label>
          <input
            id="note-reminder"
            type="datetime-local"
            value={reminderAt}
            min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
            onChange={(event) => setReminderAt(event.target.value)}
          />
          <span className="field-help">Alerts work while Memo is open. Allow browser notifications when prompted.</span>
        </div>

        {error && <p className="auth-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button className="secondary-button" onClick={onClose} type="button">Cancel</button>
          <button className="primary-button" type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : type === "edit" ? "Save changes" : "Create note"}
          </button>
        </div>
      </form>
    </div>
  );
}
