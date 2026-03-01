'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BookCopyWithMaster, DashboardStats } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { Sale } from '@/types';
import {
  BookOpen, Package, ArrowUpDown,
  Activity, Clock, RefreshCw, Search, ChevronDown,
  Scan, Layers, TrendingUp, MapPin, DollarSign, ShoppingCart, BarChart2,
} from 'lucide-react';

export default function DashboardPage() {
  const supabase = createClient();
  const [stats, setStats] = useState<DashboardStats>({
    total_copies: 0, in_stock: 0, checked_out: 0, lost: 0, total_titles: 0,
    total_sales: 0, total_revenue: 0,
  });
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [copies, setCopies] = useState<BookCopyWithMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveFlash, setLiveFlash] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    const [copiesRes, salesRes] = await Promise.all([
      supabase.from('book_copies').select('*, books_master(*)').order('date_added', { ascending: false }).limit(500),
      supabase.from('sales').select('*').order('sold_at', { ascending: false }).limit(200),
    ]);

    if (copiesRes.error) { console.error(copiesRes.error); }
    if (salesRes.error) { console.error(salesRes.error); }

    const all = (copiesRes.data ?? []) as BookCopyWithMaster[];
    setCopies(all);

    const salesAll = (salesRes.data ?? []) as Sale[];
    setRecentSales(salesAll.slice(0, 5));

    const titles = new Set(all.map((c) => c.book_id));
    const totalRevenue = salesAll.reduce((sum, s) => sum + Number(s.price_paid), 0);
    setStats({
      total_copies: all.length,
      in_stock: all.filter((c) => c.status === 'in_stock').length,
      checked_out: all.filter((c) => c.status === 'checked_out').length,
      lost: all.filter((c) => c.status === 'lost').length,
      total_titles: titles.size,
      total_sales: salesAll.length,
      total_revenue: totalRevenue,
    });
    setLastUpdated(new Date());
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();

    const channel = supabase
      .channel('realtime-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'book_copies' }, () => {
        setLiveFlash(true);
        setTimeout(() => setLiveFlash(false), 1500);
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchData, supabase]);

  const filtered = copies.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      c.epc_tag.toLowerCase().includes(q) ||
      c.books_master?.title?.toLowerCase().includes(q) ||
      (c.books_master?.isbn ?? '').toLowerCase().includes(q) ||
      (c.books_master?.category ?? '').toLowerCase().includes(q) ||
      (c.location ?? '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Category breakdown
  const categoryCounts = copies.reduce<Record<string, number>>((acc, c) => {
    const cat = c.books_master?.category ?? 'Uncategorised';
    acc[cat] = (acc[cat] ?? 0) + 1;
    return acc;
  }, {});
  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Top locations
  const locationCounts = copies.reduce<Record<string, number>>((acc, c) => {
    const loc = c.location ?? 'No location';
    acc[loc] = (acc[loc] ?? 0) + 1;
    return acc;
  }, {});
  const topLocations = Object.entries(locationCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  // Recent additions (last 5)
  const recent = copies.slice(0, 5);

  const stockRate = stats.total_copies > 0
    ? Math.round((stats.in_stock / stats.total_copies) * 100)
    : 0;

  const statCards = [
    { label: 'Total Copies', value: stats.total_copies, icon: Package, color: 'text-white', bg: 'bg-white/5', fmt: 'num' },
    { label: 'In Stock', value: stats.in_stock, icon: BookOpen, color: 'text-emerald-400', bg: 'bg-emerald-500/5', fmt: 'num' },
    { label: 'Checked Out', value: stats.checked_out, icon: ArrowUpDown, color: 'text-amber-400', bg: 'bg-amber-500/5', fmt: 'num' },
    { label: 'Items Sold', value: stats.total_sales, icon: ShoppingCart, color: 'text-purple-400', bg: 'bg-purple-500/5', fmt: 'num' },
    { label: 'Total Revenue', value: stats.total_revenue, icon: DollarSign, color: 'text-green-400', bg: 'bg-green-500/5', fmt: 'currency' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Inventory Dashboard</h1>
            <p className="text-sm text-[#555] mt-1">Real-time RFID stock tracking · StockMind</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {lastUpdated && (
              <span className="text-xs text-[#444] hidden sm:flex items-center gap-1.5">
                <Clock size={11} />
                {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all duration-500 ${
              liveFlash
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                : 'border-[#2a2a2a] bg-[#111] text-[#444]'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full transition-all ${liveFlash ? 'bg-emerald-400 scan-pulse' : 'bg-[#333]'}`} />
              Live
            </div>
            <button
              onClick={fetchData}
              className="p-1.5 rounded-lg border border-[#2a2a2a] text-[#555] hover:text-white hover:border-[#3a3a3a] transition-colors"
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {statCards.map(({ label, value, icon: Icon, color, bg, fmt }) => (
            <div
              key={label}
              className={`${bg} border border-[#2a2a2a] rounded-xl p-4 hover:border-[#3a3a3a] transition-colors`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-[#555] font-medium">{label}</span>
                <Icon size={14} className={color} />
              </div>
              <div className={`text-2xl font-bold ${color}`}>
                {loading
                  ? <span className="inline-block w-8 h-7 bg-[#1e1e1e] rounded animate-pulse" />
                  : fmt === 'currency'
                    ? `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : Number(value).toLocaleString()}
              </div>
            </div>
          ))}
        </div>

        {/* Stock health + quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Stock health bar */}
          <div className="sm:col-span-2 bg-[#111] border border-[#2a2a2a] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp size={15} className="text-white" />
                <span className="text-sm font-semibold text-white">Stock Health</span>
              </div>
              <span className="text-xs text-[#555]">{stats.total_copies} total copies</span>
            </div>
            {loading ? (
              <div className="h-3 bg-[#1e1e1e] rounded-full animate-pulse" />
            ) : stats.total_copies === 0 ? (
              <div className="text-[#444] text-xs">No data yet — start scanning to populate.</div>
            ) : (
              <>
                <div className="flex h-3 rounded-full overflow-hidden gap-px">
                  {stats.in_stock > 0 && (
                    <div className="bg-emerald-500 transition-all" style={{ width: `${(stats.in_stock / stats.total_copies) * 100}%` }} />
                  )}
                  {stats.checked_out > 0 && (
                    <div className="bg-amber-500 transition-all" style={{ width: `${(stats.checked_out / stats.total_copies) * 100}%` }} />
                  )}
                  {stats.lost > 0 && (
                    <div className="bg-red-500 transition-all" style={{ width: `${(stats.lost / stats.total_copies) * 100}%` }} />
                  )}
                </div>
                <div className="flex items-center gap-5 mt-3 text-xs text-[#555]">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />{stockRate}% in stock</span>
                  {stats.checked_out > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" />{stats.checked_out} out</span>}
                  {stats.lost > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />{stats.lost} lost</span>}
                </div>
              </>
            )}
          </div>

          {/* Quick actions */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-5 flex flex-col gap-3">
            <div className="text-sm font-semibold text-white mb-1">Quick Actions</div>
            <Link href="/sales" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white text-black hover:bg-[#e6e6e6] transition-colors font-semibold text-sm">
              <ShoppingCart size={15} />
              Record Sale
            </Link>
            <Link href="/add/bulk" className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#2a2a2a] text-[#888] hover:text-white hover:border-[#3a3a3a] transition-colors text-sm font-medium">
              <Layers size={15} />
              Bulk Add
            </Link>
            <Link href="/reports" className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#2a2a2a] text-[#888] hover:text-white hover:border-[#3a3a3a] transition-colors text-sm font-medium">
              <BarChart2 size={15} />
              View Reports
            </Link>
          </div>
        </div>

        {/* Categories + Locations + Recent */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Top categories */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={14} className="text-blue-400" />
              <span className="text-sm font-semibold text-white">Categories</span>
            </div>
            {loading ? (
              <div className="space-y-3">{Array.from({length: 4}).map((_,i) => <div key={i} className="h-4 bg-[#1e1e1e] rounded animate-pulse" />)}</div>
            ) : topCategories.length === 0 ? (
              <div className="text-[#444] text-xs">No data yet</div>
            ) : (
              <div className="space-y-3">
                {topCategories.map(([cat, count]) => {
                  const pct = Math.round((count / stats.total_copies) * 100);
                  return (
                    <div key={cat}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#888] truncate mr-2">{cat}</span>
                        <span className="text-white font-semibold shrink-0">{count}</span>
                      </div>
                      <div className="h-1.5 bg-[#1e1e1e] rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top locations */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <MapPin size={14} className="text-purple-400" />
              <span className="text-sm font-semibold text-white">Locations</span>
            </div>
            {loading ? (
              <div className="space-y-2">{Array.from({length: 4}).map((_,i) => <div key={i} className="h-10 bg-[#1e1e1e] rounded animate-pulse" />)}</div>
            ) : topLocations.length === 0 ? (
              <div className="text-[#444] text-xs">No location data yet</div>
            ) : (
              <div className="space-y-2">
                {topLocations.map(([loc, count]) => (
                  <div key={loc} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#161616] border border-[#1e1e1e]">
                    <span className="text-[#888] text-xs truncate mr-2">{loc}</span>
                    <span className="text-white text-xs font-bold shrink-0 bg-[#222] px-2 py-0.5 rounded-md">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent additions */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={14} className="text-amber-400" />
              <span className="text-sm font-semibold text-white">Recently Added</span>
            </div>
            {loading ? (
              <div className="space-y-2">{Array.from({length: 4}).map((_,i) => <div key={i} className="h-10 bg-[#1e1e1e] rounded animate-pulse" />)}</div>
            ) : recent.length === 0 ? (
              <div className="text-[#444] text-xs">No items yet</div>
            ) : (
              <div className="space-y-2">
                {recent.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#161616] border border-[#1e1e1e] fade-in">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-xs font-medium truncate">{c.books_master?.title ?? 'Unknown'}</div>
                      <div className="text-[#444] text-[10px] font-mono truncate mt-0.5">{c.epc_tag}</div>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Sales */}
        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShoppingCart size={14} className="text-purple-400" />
              <span className="text-sm font-semibold text-white">Recent Sales</span>
            </div>
            <Link href="/reports" className="text-xs text-[#555] hover:text-white transition-colors">View all →</Link>
          </div>
          {loading ? (
            <div className="space-y-2">{Array.from({length: 4}).map((_,i) => <div key={i} className="h-10 bg-[#1e1e1e] rounded animate-pulse" />)}</div>
          ) : recentSales.length === 0 ? (
            <div className="text-[#444] text-xs">No sales yet — <Link href="/sales" className="text-purple-400 hover:text-purple-300 underline">record a sale</Link></div>
          ) : (
            <div className="space-y-2">
              {recentSales.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#161616] border border-[#1e1e1e] fade-in">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-xs font-medium truncate">{s.title}</div>
                    <div className="text-[#444] text-[10px] truncate mt-0.5">{new Date(s.sold_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                  </div>
                  <span className="text-green-400 text-xs font-bold shrink-0">${Number(s.price_paid).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Full inventory table */}
        <div>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
            <input
              type="text"
              placeholder="Search by title, EPC, ISBN, category, location…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#161616] border border-[#2a2a2a] rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#555] transition-colors"
            />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none bg-[#161616] border border-[#2a2a2a] rounded-lg pl-3 pr-8 py-2 text-sm text-[#888] focus:outline-none focus:border-[#555] cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="in_stock">In Stock</option>
              <option value="checked_out">Checked Out</option>
              <option value="lost">Lost</option>
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#555] pointer-events-none" />
          </div>
        </div>

        {/* Table */}
        <div className="border border-[#2a2a2a] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a2a] bg-[#111]">
                  {['EPC Tag', 'Title', 'ISBN', 'Category', 'Location', 'Status', 'Date Added'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-medium text-[#555] uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-[#1a1a1a]">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-3 bg-[#1e1e1e] rounded animate-pulse w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-20 text-center">
                      <div className="text-[#333] text-4xl mb-3">📦</div>
                      <div className="text-[#444] text-sm font-medium">
                        {search || statusFilter !== 'all' ? 'No results match your filters.' : 'No inventory yet.'}
                      </div>
                      {!search && statusFilter === 'all' && (
                        <Link href="/scan" className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-white text-black text-xs font-semibold hover:bg-[#e6e6e6] transition-colors">
                          <Scan size={12} /> Start scanning
                        </Link>
                      )}
                    </td>
                  </tr>
                ) : (
                  filtered.map((copy) => (
                    <tr key={copy.id} className="border-b border-[#1a1a1a] hover:bg-[#161616] transition-colors fade-in">
                      <td className="px-4 py-3">
                        <code className="text-xs text-[#888] font-mono bg-[#1a1a1a] px-1.5 py-0.5 rounded">
                          {copy.epc_tag}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-white font-medium max-w-[200px] truncate">
                        {copy.books_master?.title ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-[#666] font-mono text-xs">
                        {copy.books_master?.isbn ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-[#666]">
                        {copy.books_master?.category ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-[#666]">
                        {copy.location ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={copy.status} />
                      </td>
                      <td className="px-4 py-3 text-[#555] text-xs whitespace-nowrap">
                        {new Date(copy.date_added).toLocaleDateString('en-GB', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="px-4 py-2.5 border-t border-[#1a1a1a] bg-[#0d0d0d] text-xs text-[#444] flex items-center justify-between">
              <span>Showing <strong className="text-white">{filtered.length}</strong> of <strong className="text-white">{copies.length}</strong> records</span>
              {(search || statusFilter !== 'all') && (
                <button onClick={() => { setSearch(''); setStatusFilter('all'); }} className="text-[#444] hover:text-white transition-colors">
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

