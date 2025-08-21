/* eslint-env browser */
import { useEffect, useState } from "react";

// Read API base (localStorage first, then Vite .env)
function getApiBase() {
  const ls = (localStorage.getItem("apiBase") || "").trim().replace(/\/+$/, "");
  const env =
    (import.meta?.env?.VITE_API_BASE ? String(import.meta.env.VITE_API_BASE) : "")
      .trim()
      .replace(/\/+$/, "");
  return ls || env || "";
}

function Masked({ value }) {
  if (!value) return <span style={{ color: "#9ca3af" }}>not set</span>;
  const tail = String(value).slice(-6);
  return <span>••••••••••••{tail}</span>;
}

export default function PremiumPicks() {
  const [apiBase, setApiBase] = useState(getApiBase());
  const [adminKey, setAdminKey] = useState(localStorage.getItem("adminKey") || "");
  const [note, setNote] = useState("");

  useEffect(() => {
    const onStorage = () => {
      setApiBase(getApiBase());
      setAdminKey(localStorage.getItem("adminKey") || "");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const ready = Boolean(apiBase) && Boolean(adminKey);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 12px" }}>Premium Picks</h1>

      <p style={{ color: "#4b5563", marginBottom: 12 }}>
        This section will show the gated premium feed once your{" "}
        <code>ADMIN_KEY</code> is set. Use the inputs in the header to set:
      </p>

      <ul style={{ margin: "0 0 12px 18px", color: "#374151" }}>
        <li>
          <b>API</b>: <code>{apiBase || "(unset)"}</code>
        </li>
        <li>
          <b>Admin Key</b>: <Masked value={adminKey} />
        </li>
      </ul>

      {!ready ? (
        <div
          style={{
            border: "1px solid #fde68a",
            background: "#fffbeb",
            color: "#92400e",
            padding: 12,
            borderRadius: 12,
            marginBottom: 12,
          }}
        >
          Paste your <b>ADMIN_KEY</b> in the header box and click <b>Set</b>. Make sure the API is{" "}
          <code>http://127.0.0.1:5050</code> (dev) or <code>https://api.46bettor.com</code> (prod).
        </div>
      ) : (
        <div
          style={{
            border: "1px solid #bbf7d0",
            background: "#ecfdf5",
            color: "#065f46",
            padding: 12,
            borderRadius: 12,
            marginBottom: 12,
          }}
        >
          Admin key detected — premium endpoints are ready to wire up.
        </div>
      )}

      <details style={{ marginTop: 16 }} onToggle={() => setNote("")}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Developer note</summary>
        <div style={{ marginTop: 8, color: "#4b5563" }}>
          Once your protected endpoints are finalized (e.g. <code>/api/premium/*</code>), we’ll fetch them
          here using the <code>x-admin-key</code> header and render the premium feed.
        </div>
      </details>

      {note && (
        <div style={{ marginTop: 8, color: "#b91c1c" }}>
          {note}
        </div>
      )}
    </div>
  );
}
