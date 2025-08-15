// src/App.jsx
import React, { useEffect, useMemo, useState, Suspense } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  NavLink,
  Navigate,
  useInRouterContext,
} from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import PremiumPicks from "./pages/PremiumPicks";
import Scoreboard from "./pages/Scoreboard";

// ---------- Helpers ----------
function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function useAdminKey() {
  const [key, setKey] = useState(
    import.meta.env.VITE_ADMIN_KEY || localStorage.getItem("ADMIN_KEY") || ""
  );
  useEffect(() => {
    if (key) localStorage.setItem("ADMIN_KEY", key);
  }, [key]);
  return [key, setKey];
}

function useApiBase() {
  return import.meta.env.VITE_API_BASE || "http://localhost:5051";
}

// ---------- UI bits ----------
function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        classNames(
          "px-2 py-1 rounded-md text-sm",
          isActive ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
        )
      }
    >
      {children}
    </NavLink>
  );
}

function AdminKeyControl() {
  const [key, setKey] = useAdminKey();
  const [open, setOpen] = useState(false);

  const masked = useMemo(() => {
    if (!key) return "not set";
    const tail = key.slice(-6);
    return `••••••••••••${tail}`;
  }, [key]);

  return (
    <div className="ml-auto flex items-center gap-2">
      <div className="text-xs text-gray-500">
        Admin Key: <span className="font-mono">{masked}</span>
      </div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs px-2 py-1 rounded-md border bg-white hover:bg-gray-50"
      >
        {open ? "Close" : "Set"}
      </button>
      {open && (
        <div className="absolute right-4 top-12 z-20 w-72 rounded-xl border bg-white p-3 shadow-lg">
          <div className="text-xs text-gray-600 mb-1">Set Admin Key (dev)</div>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="paste your ADMIN_KEY"
            className="w-full border rounded-md px-2 py-1 text-sm"
          />
          <div className="mt-2 flex gap-2 justify-end">
            <button
              onClick={() => {
                localStorage.removeItem("ADMIN_KEY");
                setKey("");
              }}
              className="text-xs px-2 py-1 rounded-md border bg-white hover:bg-gray-50"
            >
              Clear
            </button>
            <button
              onClick={() => setOpen(false)}
              className="text-xs px-2 py-1 rounded-md border bg-gray-900 text-white"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Header() {
  const API_BASE = useApiBase();
  return (
    <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-3">
        <Link to="/" className="font-semibold tracking-tight">46bettor</Link>
        <nav className="flex items-center gap-1">
          <NavItem to="/">Dashboard</NavItem>
          <NavItem to="/premium">Premium Picks</NavItem>
          <NavItem to="/scoreboard">Scoreboard</NavItem>
        </nav>
        <div className="ml-4 text-[10px] text-gray-500">
          API: <code>{API_BASE}</code>
        </div>
        <AdminKeyControl />
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t bg-white mt-8">
      <div className="max-w-6xl mx-auto px-4 py-3 text-xs text-gray-500">
        © {new Date().getFullYear()} 46bettor • Built for speed
      </div>
    </footer>
  );
}

// ---------- Routes-only content ----------
function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/premium" element={<PremiumPicks />} />
      <Route path="*" element={<Navigate to="/" replace />} />
      <Route path="/scoreboard" element={<Scoreboard />} />
    </Routes>
  );
}

// ---------- Layout wrapper ----------
function AppShell() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="max-w-6xl mx-auto p-4">
          <Suspense fallback={<div className="text-sm text-gray-500">Loading…</div>}>
            <AppRoutes />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  );
}

// ---------- Main export ----------
// If an outer router exists (in main.jsx), DON'T add BrowserRouter again.
// Otherwise, wrap with BrowserRouter here.
export default function App() {
  const hasRouter = useInRouterContext();
  const content = <AppShell />;
  return hasRouter ? content : <BrowserRouter>{content}</BrowserRouter>;
}
