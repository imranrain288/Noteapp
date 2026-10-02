import { useState } from "react";
import { MdAdd, MdClose } from "react-icons/md";

export default function TagInput({ tags, setTags }) {
  const [tagInput, setTagInput] = useState("");

  const addNewTag = () => {
    const nextTag = tagInput.trim();
    if (nextTag === "" || nextTag.length > 24) return;
    if (tags.length >= 8) return;
    if (tags.some((tag) => tag.toLowerCase() === nextTag.toLowerCase())) return;

    setTags([...tags, nextTag]);
    setTagInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addNewTag();
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    const newTags = tags.filter((tag) => tag !== tagToRemove);
    setTags(newTags);
  }

  return (
    <div>
      {tags?.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mt-2">
          {tags.map((tag, index) => (
            <span
              key={index}
              className="tag-chip flex items-center gap-1">
              #{tag}
              <button type="button" aria-label={`Remove keyword ${tag}`} onClick={() => handleRemoveTag(tag)}>
                <MdClose className="text-red-600 text-sm"/>
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-2">
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={handleKeyDown}
          type="text"
          className="flex-grow bg-transparent border px-3 py-2 rounded outline-none text-sm"
          placeholder="Add a keyword and press Enter"
          maxLength={24}
          aria-label="Add keyword"
        />
        <button
          type="button"
          onClick={addNewTag}
          className="w-9 h-9 flex items-center justify-center rounded border border-blue-700 hover:bg-blue-700 hover:text-white"
        >
          <MdAdd className="text-2xl text-blue-700 hover:text-white" />
        </button>
      </div>
    </div>
  );
}
