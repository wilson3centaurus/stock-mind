'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { LayoutDashboard, PackagePlus, Layers, BarChart2, Settings, Menu, X, LogOut, ShoppingCart, ClipboardList } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/sales', label: 'Sales', icon: ShoppingCart },
  { href: '/stock-count', label: 'Stock Count', icon: ClipboardList },
  { href: '/reports', label: 'Reports', icon: BarChart2 },
  { href: '/add/single', label: 'Single Add', icon: PackagePlus },
  { href: '/add/bulk', label: 'Bulk Add', icon: Layers },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Navbar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[#2a2a2a] bg-[#0d0d0d]/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">

          {/* Logo + Brand */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0" onClick={() => setMobileOpen(false)}>
            <div className="w-7 h-7 relative">
              <Image src="/robokorda-logo.jpg" alt="RoboKorda" fill className="object-contain rounded-sm" />
            </div>
            <span className="text-white font-semibold text-[15px] tracking-tight">StockMind</span>
            <span className="hidden sm:inline text-[#555] text-xs font-medium border border-[#2a2a2a] px-1.5 py-0.5 rounded">RFID</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    active ? 'bg-white text-black font-medium' : 'text-[#888] hover:text-white hover:bg-[#1e1e1e]'
                  }`}
                >
                  <Icon size={14} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#555]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Live
            </div>
            <button
              onClick={handleLogout}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-[#555] hover:text-red-400 hover:bg-red-500/5 transition-colors border border-transparent hover:border-red-500/20"
              title="Sign out"
            >
              <LogOut size={13} />
              Sign out
            </button>
            <button
              className="md:hidden p-1.5 rounded-md text-[#888] hover:text-white hover:bg-[#1e1e1e] transition-colors"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[#2a2a2a] bg-[#0d0d0d]">
          <nav className="px-4 py-3 flex flex-col gap-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    active ? 'bg-white text-black font-medium' : 'text-[#888] hover:text-white hover:bg-[#1e1e1e]'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
            <button
              onClick={() => { setMobileOpen(false); handleLogout(); }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#555] hover:text-red-400 hover:bg-red-500/5 transition-colors mt-1 border-t border-[#1a1a1a] pt-3"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
