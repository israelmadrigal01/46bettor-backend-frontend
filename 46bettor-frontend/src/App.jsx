/* eslint-env browser */
import { useMemo, useState } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';

import Dashboard from './pages/Dashboard.jsx';
import PremiumPicks from './pages/PremiumPicks.jsx';
import Scoreboard from './pages/Scoreboard.jsx';
import Schedule from './pages/Schedule.jsx';
import PickDetail from './pages/PickDetail.jsx';
import Thanks from './pages/Thanks.jsx';
import Contact from './pages/Contact.jsx';
import About from './pages/About.jsx';

function Masked({ value }) {
  if (!value) return <span className="text-gray-400">not set</span>;
  const tail = String(value).slice(-6);
  return <span>••••••••••••{tail}</span>;
}

export default function App() {
  // defaults
  const defaultApi =
    (localStorage.getItem('apiBase') || import.meta.env.VITE_API_BASE || 'https://api.46bettor.com').trim();

  const [apiBaseInput, setApiBaseInput] = useState(defaultApi);
  const [adminKeyInput, setAdminKeyInput] = useState(localStorage.getItem('adminKey') || '');
  const [savedFlash, setSavedFlash] = useState(false);

  const activeLink = 'px-3 py-2 rounded-xl bg-black text-white';
  const idleLink = 'px-3 py-2 rounded-xl text-gray-700 hover:bg-gray-100';

  const applySettings = () => {
    const base = apiBaseInput.trim().replace(/\/+$/, '');
    localStorage.setItem('apiBase', base || '');
    if (adminKeyInput.trim()) {
      localStorage.setItem('adminKey', adminKeyInput.trim());
    } else {
      localStorage.removeItem('adminKey');
    }
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
    // broadcast so pages that listen can react immediately
    window.dispatchEvent(new Event('storage'));
  };

  const currentApiBase = useMemo(
    () => (localStorage.getItem('apiBase') || apiBaseInput || '').trim(),
    [apiBaseInput]
  );
  const currentAdminKey = useMemo(
    () => (localStorage.getItem('adminKey') || adminKeyInput || '').trim(),
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
              <NavLink to="/schedule" className={({ isActive }) => (isActive ? activeLink : idleLink)}>
                Schedule
              </NavLink>
              <NavLink to="/about" className={({ isActive }) => (isActive ? activeLink : idleLink)}>
                About
              </NavLink>
              <NavLink to="/contact" className={({ isActive }) => (isActive ? activeLink : idleLink)}>
                Contact
              </NavLink>
            </nav>
          </div>

          {/* Controls */}
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
                Current: <span className="font-mono">{currentApiBase || '(unset)'}</span>
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

            {savedFlash && <span className="text-green-600 text-sm">Saved ✓</span>}
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
            <NavLink to="/schedule" className={({ isActive }) => (isActive ? activeLink : idleLink)}>
              Schedule
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
          <Route path="/schedule" element={<Schedule />} />
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
