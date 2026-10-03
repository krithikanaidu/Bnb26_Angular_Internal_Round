import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { AsteriskBurst } from '@/components/DoodleOutline';

const TABS = [
  { label: 'Dashboard', path: '/', number: '01' },
  { label: 'Scripts & Hooks', path: '/scripts', number: '02' },
  { label: 'Assets', path: '/assets', number: '03' },
  { label: 'Studio', path: '/studio', number: '04' },
  { label: 'Review', path: '/review', number: '05' },
  { label: 'Publish', path: '/publish', number: '06' },
  { label: 'Insights', path: '/insights', number: '07' },
];

export function NavBar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop nav */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-white/70 backdrop-blur-md border-b border-ink/5">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2">
            <AsteriskBurst size={20} />
            <span className="font-display font-black text-lg tracking-tight text-ink">
              Creator<span style={{ color: 'var(--hot-pink)' }}>Ai</span>
            </span>
          </NavLink>

          {/* Desktop tabs */}
          <div className="hidden md:flex items-center gap-1">
            {TABS.map((tab) => (
              <NavLink
                key={tab.path}
                to={tab.path}
                end={tab.path === '/'}
                className={({ isActive }) =>
                  `relative px-3 py-1.5 rounded-lg font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
                    isActive ? 'text-white' : 'text-ink/60 hover:text-ink'
                  }`
                }
                style={({ isActive }) =>
                  isActive ? { background: 'var(--hot-pink)' } : undefined
                }
              >
                <span className="opacity-50 mr-1">{tab.number}</span>
                {tab.label}
              </NavLink>
            ))}
            <NavLink
              to="/playground"
              className="px-3 py-1.5 rounded-lg font-mono text-[11px] font-bold uppercase tracking-wider text-ink/40 hover:text-ink/70"
            >
              PG
            </NavLink>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden px-3 py-1.5 rounded-lg font-mono text-xs font-bold text-ink"
            aria-label="Toggle menu"
          >
            {open ? 'CLOSE' : 'MENU'}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.nav
            className="fixed inset-0 z-30 bg-white/95 backdrop-blur-md pt-16 px-6 md:hidden"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="flex flex-col gap-3 mt-8">
              {TABS.map((tab, i) => (
                <motion.div
                  key={tab.path}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <NavLink
                    to={tab.path}
                    end={tab.path === '/'}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 py-3 border-b border-ink/10 font-display font-bold text-lg ${
                        isActive ? 'text-hot-pink' : 'text-ink'
                      }`
                    }
                  >
                    <span className="font-mono text-xs text-ink/30">{tab.number}</span>
                    {tab.label}
                  </NavLink>
                </motion.div>
              ))}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  );
}
