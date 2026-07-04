import { useState, createContext, useContext } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Settings, TruckIcon, PackageIcon, Menu, X, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';

// Emil Kowalski: strong ease-out for UI, iOS drawer curve for slide-in
const EASE_OUT_EXPO = [0.23, 1, 0.32, 1] as const;
const EASE_DRAWER = [0.32, 0.72, 0, 1] as const;

// ─── Context ──────────────────────────────────────────────────────────────────

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);

function useSidebarCtx() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebarCtx must be used within SidebarContext.Provider');
  return ctx;
}

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { to: '/orders', icon: PackageIcon, label: 'Orders' },
  { to: '/partners', icon: Users, label: 'Partners' },
  { to: '/vehicles', icon: TruckIcon, label: 'Vehicles' },
  // { to: '/invoices', icon: Receipt, label: 'Invoices' }, // TODO: Implement invoices
  { to: '/statistics', icon: BarChart3, label: 'Statistics' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

// ─── Main export ──────────────────────────────────────────────────────────────

export function Sidebar() {
  const [open, setOpen] = useState(false);
  return (
    <SidebarContext.Provider value={{ open, setOpen }}>
      <DesktopSidebar />
      <MobileSidebar />
    </SidebarContext.Provider>
  );
}

// ─── Desktop (hover-to-expand) ────────────────────────────────────────────────

function DesktopSidebar() {
  const { open, setOpen } = useSidebarCtx();
  const prefersReduced = useReducedMotion();

  return (
    // Fixed-width outer placeholder — always 60px in the flex layout.
    // The inner panel expands absolutely over the main content so the flex
    // layout never reflowes → zero CLS from the sidebar animation.
    <div
      className="hidden md:block flex-shrink-0 w-[60px] relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <motion.div
        className="absolute inset-y-0 left-0 flex flex-col bg-gray-900 overflow-hidden z-20"
        animate={{ width: open ? 240 : 60 }}
        transition={prefersReduced ? { duration: 0 } : { duration: 0.2, ease: [...EASE_OUT_EXPO] }}
        style={open ? { boxShadow: '4px 0 16px rgba(0,0,0,0.35)' } : undefined}
      >
        {/* Logo */}
        <div className="flex h-14 items-center px-4 border-b border-gray-700 flex-shrink-0 overflow-hidden">
          <TruckIcon className="h-6 w-6 text-blue-400 shrink-0" />
          <motion.span
            animate={{ opacity: open ? 1 : 0, width: open ? 'auto' : 0 }}
            transition={prefersReduced ? { duration: 0 } : { duration: 0.15, ease: [...EASE_OUT_EXPO] }}
            className="ml-3 font-bold text-white text-lg tracking-wide whitespace-nowrap overflow-hidden"
          >
            BGR-TMS
          </motion.span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 flex flex-col gap-1 px-2 py-4 overflow-hidden">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors overflow-hidden',
                  isActive
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white',
                )
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              <motion.span
                animate={{ opacity: open ? 1 : 0, width: open ? 'auto' : 0 }}
                transition={prefersReduced ? { duration: 0 } : { duration: 0.15, ease: [...EASE_OUT_EXPO] }}
                className="whitespace-nowrap overflow-hidden"
              >
                {label}
              </motion.span>
            </NavLink>
          ))}
        </nav>

      </motion.div>
    </div>
  );
}

// ─── Mobile (slide-in drawer) ─────────────────────────────────────────────────

function MobileSidebar() {
  const { open, setOpen } = useSidebarCtx();

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex md:hidden h-14 items-center px-4 bg-gray-900 border-b border-gray-700 w-full flex-shrink-0">
        <button onClick={() => setOpen(!open)} className="text-gray-400 hover:text-white transition-[transform,colors] duration-100">
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* Drawer overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: '-100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0 }}
            transition={{ duration: 0.25, ease: [...EASE_DRAWER] }}
            className="fixed inset-0 z-50 flex md:hidden"
          >
            {/* Sidebar panel */}
            <div className="flex flex-col w-64 h-full bg-gray-900">
              <div className="flex h-14 items-center justify-between px-4 border-b border-gray-700">
                <span className="font-bold text-white text-lg">BGR-TMS</span>
                <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white transition-[transform,colors] duration-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="flex-1 flex flex-col gap-1 px-2 py-4">
                {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-gray-700 text-white'
                          : 'text-gray-400 hover:bg-gray-800 hover:text-white',
                      )
                    }
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {label}
                  </NavLink>
                ))}
              </nav>

            </div>

            {/* Click-outside to close */}
            <div className="flex-1" onClick={() => setOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
