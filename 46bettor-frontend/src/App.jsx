/* eslint-env browser */
import { useMemo, useState } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';

import Dashboard from './pages/Dashboard.jsx';
import PremiumPicks from './pages/PremiumPicks.jsx';
import Scoreboard from './pages/Scoreboard.jsx';
import PickDetail from './pages/PickDetail.jsx';

/* --- Simple inline pages so nothing errors if you didn't create files --- */
function About() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-3xl font-bold">About 46bettor</h1>
      <p className="text-gray-600">
        46bettor tracks model-driven picks with bankroll, ROI, and sport-level splits.
        The dashboard uses public endpoints for stats and an admin key (stored in your
        browser) for protected metrics.
      </p>
      <ul className="list-disc pl-6 text-gray-700 space-y-1">
        <li>Live tiles & ledger</li>
        <li>Sport / tags breakdown</li>
        <li>Public endpoints for transparency</li>
      </ul>
    </div>
  );
}

function Contact() {
  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">Contact</h1>
      <form name="contact" method="POST" data-netlify="true" action="/thanks" className="space-y-4">
        <input type="hidden" name="form-name" value="contact" />
        <label className="block">
          <span className="text-sm text-gray-700">Name</span>
          <input name="name" required className="mt-1 w-full rounded-xl border p-3" />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">Email</span>
          <input name="email" type="email" required className="mt-1 w-full rounded-xl border p-3" />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">Message</span>
          <textarea name="message" rows="5" required className="mt-1 w-full rounded-xl border p-3" />
        </label>
        <button className="rounded-2xl px-5 py-2.5 bg-black text-white">Send</button>
      </form>
      <p className="text-sm text-gray-500 mt-3">Submissions appear in Netlify → Forms.</p>
    </div>
  );
}

function Thanks() {
  return (
    <div className="max-w-xl mx-auto p-6 text-center">
      <h1 className="text-3xl font-bold mb-2">Thanks!</h1>
      <p className="text-gray-600">We got your message and will reply soon.</p>
    </div>
  );
}
/* ----------------------------------------------------------------------- */

function Masked({ value }) {
  if (!value) return <span className="text-gray-400">not set</span>;
  const tail = value.slice(-6);
  return <span>••••••••••••{tail}</span>;
}

export default function App() {
  const [apiBaseInput, setApiBaseInput] = useState(
    localStorage.getItem('apiBase') || 'https://api.46bettor.com'
  );
  const [adminKeyInput, setAdminKeyInput] = useState(
    localStorage.getItem('adminKey') || ''
  );
  const [savedFlash, setSavedFlash] = useState(false);

  const activeLink = 'px-3 py-2 rounded-xl bg-black text-white';
  const idleLink = 'px-3 py-2 rounded-xl text-gray-700 hover:bg-gray-100';

  const applySettings = () => {
    localStorage.setItem('apiBase', apiBaseInput.trim());
    if (adminKeyInput.trim()) {
      localStorage.setItem('adminKey', adminKeyInput.trim());
    }
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
    window.dispatchEvent(new Event('storage'));
  };

  const currentApiBase = useMemo(
    () => localStorage.getItem('apiBase') || apiBaseInput,
    [apiBaseInput]
  );
  const currentAdminKey = useMemo(
    () => localStorage.getItem('adminKey') || adminKeyInput,
    [adminKeyInput]
  );

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="text-xl font-bold">46bettor</div>
            <nav className="hidden md:flex items-center gap-2">
              <NavLink to="/" end className={({ isActive }) => (isActive ? activeLink : idleLink)}>
                Dashboard
              </NavLink>
              <NavLink to="/premium" className={({ isActive }) => (isActive ? activeLink : idleLink)}>
                Premium Picks
              </NavLink>
              <NavLink to="/scoreboard" className={({ isActive }) => (isActive ? activeLink : idleLink)}>
                Scoreboard
              </NavLink>
              <NavLink to="/about" className={({ isActive }) => (isActive ? activeLink : idleLink)}>
                About
              </NavLink>
              <NavLink to="/contact" className={({ isActive }) => (isActive ? activeLink : idleLink)}>
                Contact
              </NavLink>
            </nav>
          </div>

          <div className="flex flex-col md:flex-row gap-2 md:items-center md:gap-3">
            <div className="text-sm">
              <div className="font-medium">API:</div>
              <div className="flex items-center gap-2">
                <input
                  className="border rounded-xl px-2 py-1 w-72"
                  value={apiBaseInput}
                  onChange={(e) => setApiBaseInput(e.target.value)}
                  placeholder="https://api.46bettor.com"
                />
              </div>
              <div className="text-xs text-gray-500">
                Current: <span className="font-mono">{currentApiBase}</span>
              </div>
            </div>

            <div className="text-sm">
              <div className="font-medium">Admin Key:</div>
              <div className="flex items-center gap-2">
                <input
                  className="border rounded-xl px-2 py-1 w-72"
                  value={adminKeyInput}
                  onChange={(e) => setAdminKeyInput(e.target.value)}
                  placeholder="paste key to enable protected metrics"
                />
              </div>
              <div className="text-xs text-gray-500">
                Current: <Masked value={currentAdminKey} />
              </div>
            </div>

            <button
              onClick={applySettings}
              className="self-start md:self-auto rounded-2xl px-4 py-2 bg-black text-white"
              title="Save API base & admin key"
            >
              Set
            </button>

            {savedFlash && (
              <span className="text-green-600 text-sm">Saved ✓</span>
            )}
          </div>
        </div>

        {/* Mobile nav */}
        <div className="md:hidden border-t">
          <div className="max-w-6xl mx-auto px-4 py-2 flex gap-2 overflow-x-auto">
            <NavLink to="/" end className={({ isActive }) => (isActive ? activeLink : idleLink)}>
              Dashboard
            </NavLink>
            <NavLink to="/premium" className={({ isActive }) => (isActive ? activeLink : idleLink)}>
              Premium
            </NavLink>
            <NavLink to="/scoreboard" className={({ isActive }) => (isActive ? activeLink : idleLink)}>
              Scoreboard
            </NavLink>
            <NavLink to="/about" className={({ isActive }) => (isActive ? activeLink : idleLink)}>
              About
            </NavLink>
            <NavLink to="/contact" className={({ isActive }) => (isActive ? activeLink : idleLink)}>
              Contact
            </NavLink>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/premium" element={<PremiumPicks />} />
          <Route path="/scoreboard" element={<Scoreboard />} />
          <Route path="/p/:id" element={<PickDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/thanks" element={<Thanks />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </main>

      <footer className="border-t">
        <div className="max-w-6xl mx-auto px-4 py-6 text-sm text-gray-500">
          © {new Date().getFullYear()} 46bettor • Built for speed
        </div>
      </footer>
    </div>
  );
}
