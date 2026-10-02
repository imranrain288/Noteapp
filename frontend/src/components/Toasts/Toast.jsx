import { MdCheck, MdDeleteOutline } from "react-icons/md";

export default function Toast({ isShown, message, type }) {
  return (
    <div className={`toast-message ${isShown ? "visible" : ""}`} role="status" aria-live="polite">
      {type === "delete" ? <MdDeleteOutline size={19} /> : <MdCheck size={19} />}
      <span>{message}</span>
    </div>
  );
}
