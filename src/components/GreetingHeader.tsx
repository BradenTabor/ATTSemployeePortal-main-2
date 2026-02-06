import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Safe localStorage getter for initial state
function getSavedName(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("atts_name");
}

export default function GreetingHeader() {
  // Use lazy initializers to avoid setState in useEffect
  const [greeting] = useState(() => getGreeting());
  const [name, setName] = useState<string | null>(() => getSavedName());
  const [editing, setEditing] = useState(false);
  const [tempName, setTempName] = useState("");

  const handleSave = () => {
    const clean = tempName.trim();
    if (clean.length > 0) {
      localStorage.setItem("atts_name", clean);
      setName(clean);
    }
    setEditing(false);
    setTempName("");
  };

  const handleClear = () => {
    localStorage.removeItem("atts_name");
    setName(null);
    setTempName("");
  };

  const handleEdit = () => {
    setTempName(name || "");
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setTempName("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="flex flex-col items-center space-y-2 text-center"
    >
      <AnimatePresence mode="wait">
        {editing ? (
          <motion.div
            key="editing"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-2"
          >
            <input
              type="text"
              placeholder="Enter your name"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") handleCancel();
              }}
              autoFocus
              className="px-3 py-2 text-base rounded-md bg-neutral-800 text-white border border-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="text-sm font-semibold text-green-400 hover:text-green-300 transition-colors"
              >
                Save
              </button>
              <button
                onClick={handleCancel}
                className="text-sm font-semibold text-gray-400 hover:text-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="display"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
          >
            <h2 className="text-base sm:text-lg text-gray-300 italic tracking-wide">
              {greeting}
              {name ? `, ${name}.` : `, welcome to ATTS.`}
            </h2>

            <div className="flex justify-center gap-4 mt-2">
              {!name && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs font-medium text-green-400 hover:text-green-300 underline transition-colors"
                >
                  Set your name
                </button>
              )}
              {name && (
                <>
                  <button
                    onClick={handleEdit}
                    className="text-xs font-medium text-green-400 hover:text-green-300 underline transition-colors"
                  >
                    Edit name
                  </button>
                  <button
                    onClick={handleClear}
                    className="text-xs font-medium text-red-400 hover:text-red-300 underline transition-colors"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
