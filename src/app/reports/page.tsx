'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Sale } from '@/types';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import {
  BarChart2, DollarSign, ShoppingCart, TrendingUp,
  RefreshCw, Clock, Search, ChevronDown, BookOpen,
  Download,
} from 'lucide-react';

type DateRange = '7d' | '30d' | '90d' | 'all';

export default function ReportsPage() {
  const supabase = createClient();

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchSales = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('sales')
      .select('*')
      .order('sold_at', { ascending: false })
      .limit(2000);

    if (dateRange !== 'all') {
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const since = new Date();
      since.setDate(since.getDate() - days);
      query = query.gte('sold_at', since.toISOString());
    }

    const { data, error } = await query;
    if (error) { console.error(error); }
    setSales((data ?? []) as Sale[]);
    setLastUpdated(new Date());
    setLoading(false);
  }, [supabase, dateRange]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  // Filtered by search
  const q = search.toLowerCase();
  const filtered = sales.filter((s) => {
    if (!q) return true;
    return (
      s.title.toLowerCase().includes(q) ||
      (s.isbn ?? '').toLowerCase().includes(q) ||
      (s.category ?? '').toLowerCase().includes(q) ||
      s.epc_tag.toLowerCase().includes(q) ||
      (s.notes ?? '').toLowerCase().includes(q)
    );
  });

  // Aggregates
  const totalRevenue = filtered.reduce((sum, s) => sum + Number(s.price_paid), 0);
  const totalItems = filtered.length;
  const avgPrice = totalItems > 0 ? totalRevenue / totalItems : 0;

  // Category breakdown
  const catRevenue = filtered.reduce<Record<string, { count: number; revenue: number }>>((acc, s) => {
    const cat = s.category ?? 'Uncategorised';
    if (!acc[cat]) acc[cat] = { count: 0, revenue: 0 };
    acc[cat].count++;
    acc[cat].revenue += Number(s.price_paid);
    return acc;
  }, {});
  const topCategories = Object.entries(catRevenue)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 6);

  // Daily revenue chart data (last 14 days for the selected range, max)
  const dayMap = filtered.reduce<Record<string, number>>((acc, s) => {
    const day = s.sold_at.slice(0, 10);
    acc[day] = (acc[day] ?? 0) + Number(s.price_paid);
    return acc;
  }, {});
  const sortedDays = Object.entries(dayMap).sort((a, b) => a[0].localeCompare(b[0])).slice(-14);
  const maxDayRev = Math.max(...sortedDays.map((d) => d[1]), 0.01);

  // Export CSV
  const exportCSV = () => {
    const headers = ['Date', 'Title', 'ISBN', 'Category', 'Location', 'EPC Tag', 'Price Paid', 'Notes'];
    const rows = filtered.map((s) => [
      new Date(s.sold_at).toLocaleDateString('en-GB'),
      `"${s.title.replace(/"/g, '""')}"`,
      s.isbn ?? '',
      s.category ?? '',
      s.location ?? '',
      s.epc_tag,
      Number(s.price_paid).toFixed(2),
      `"${(s.notes ?? '').replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stockmind-sales-${dateRange}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const dateRangeLabels: Record<DateRange, string> = {
    '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days', 'all': 'All time',
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <BarChart2 size={22} className="text-blue-400" />
              Sales Reports
            </h1>
            <p className="text-sm text-[#555] mt-1">
              {dateRangeLabels[dateRange]}
              {lastUpdated && (
                <span className="ml-2 text-[#444]">· Updated {lastUpdated.toLocaleTimeString()}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Date range */}
            <div className="relative">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRange)}
                className="appearance-none bg-[#161616] border border-[#2a2a2a] rounded-lg pl-3 pr-8 py-1.5 text-xs text-[#888] focus:outline-none focus:border-[#555] cursor-pointer"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="all">All time</option>
              </select>
              <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#555] pointer-events-none" />
            </div>
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2a2a2a] text-xs text-[#555] hover:text-white hover:border-[#3a3a3a] transition-colors"
            >
              <Download size={12} />
              Export CSV
            </button>
            <button
              onClick={fetchSales}
              className="p-1.5 rounded-lg border border-[#2a2a2a] text-[#555] hover:text-white hover:border-[#3a3a3a] transition-colors"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: DollarSign, color: 'text-green-400', bg: 'bg-green-500/5' },
            { label: 'Items Sold', value: totalItems.toLocaleString(), icon: ShoppingCart, color: 'text-purple-400', bg: 'bg-purple-500/5' },
            { label: 'Avg. Price', value: `$${avgPrice.toFixed(2)}`, icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/5' },
            { label: 'Categories', value: Object.keys(catRevenue).length.toLocaleString(), icon: BookOpen, color: 'text-amber-400', bg: 'bg-amber-500/5' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={`${bg} border border-[#2a2a2a] rounded-xl p-4`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-[#555] font-medium">{label}</span>
                <Icon size={14} className={color} />
              </div>
              <div className={`text-2xl font-bold ${color}`}>
                {loading ? <span className="inline-block w-16 h-7 bg-[#1e1e1e] rounded animate-pulse" /> : value}
              </div>
            </div>
          ))}
        </div>

        {/* Revenue chart + Category breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Daily revenue bars */}
          <div className="lg:col-span-2 bg-[#111] border border-[#2a2a2a] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp size={14} className="text-green-400" />
              <span className="text-sm font-semibold text-white">Revenue Over Time</span>
              <span className="text-xs text-[#444] ml-1">(up to last 14 days shown)</span>
            </div>
            {loading ? (
              <div className="h-32 bg-[#1e1e1e] rounded animate-pulse" />
            ) : sortedDays.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-[#444] text-sm">No sales in this period.</div>
            ) : (
              <div className="flex items-end gap-1.5 h-32">
                {sortedDays.map(([day, rev]) => {
                  const heightPct = (rev / maxDayRev) * 100;
                  return (
                    <div key={day} className="flex-1 flex flex-col items-center gap-1 group" title={`${day}: $${rev.toFixed(2)}`}>
                      <div className="w-full relative flex items-end justify-center" style={{ height: '100px' }}>
                        <div
                          className="w-full rounded-t bg-green-500/60 hover:bg-green-500 transition-colors cursor-default"
                          style={{ height: `${Math.max(heightPct, 4)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-[#444] hidden sm:block">
                        {new Date(day + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Category breakdown */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen size={14} className="text-blue-400" />
              <span className="text-sm font-semibold text-white">By Category</span>
            </div>
            {loading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 bg-[#1e1e1e] rounded animate-pulse" />)}</div>
            ) : topCategories.length === 0 ? (
              <div className="text-[#444] text-xs py-4 text-center">No data yet</div>
            ) : (
              <div className="space-y-3">
                {topCategories.map(([cat, { count, revenue }]) => {
                  const pct = totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100) : 0;
                  return (
                    <div key={cat}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#888] truncate mr-2">{cat}</span>
                        <span className="text-white font-semibold shrink-0">${revenue.toFixed(2)} <span className="text-[#444] font-normal">({count})</span></span>
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
        </div>

        {/* Sales table */}
        <div>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
              <input
                type="text"
                placeholder="Search by title, ISBN, EPC, category, notes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#161616] border border-[#2a2a2a] rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#555] transition-colors"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-[#444]">
              <Clock size={12} />
              <span>{filtered.length} records</span>
            </div>
          </div>

          <div className="border border-[#2a2a2a] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2a2a2a] bg-[#111]">
                    {['Date & Time', 'Title', 'ISBN', 'Category', 'Location', 'EPC Tag', 'Price Paid', 'Notes'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-medium text-[#555] uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-b border-[#1a1a1a]">
                        {Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-3 bg-[#1e1e1e] rounded animate-pulse w-20" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-20 text-center">
                        <div className="text-[#333] text-4xl mb-3">📊</div>
                        <div className="text-[#444] text-sm font-medium">
                          {search ? 'No results match your search.' : 'No sales recorded in this period.'}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((s) => (
                      <tr key={s.id} className="border-b border-[#1a1a1a] hover:bg-[#161616] transition-colors fade-in">
                        <td className="px-4 py-3 text-[#555] text-xs whitespace-nowrap">
                          {new Date(s.sold_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          <span className="block text-[#333] text-[10px]">
                            {new Date(s.sold_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white font-medium max-w-[180px] truncate">{s.title}</td>
                        <td className="px-4 py-3 text-[#666] font-mono text-xs">{s.isbn ?? '—'}</td>
                        <td className="px-4 py-3 text-[#666]">{s.category ?? '—'}</td>
                        <td className="px-4 py-3 text-[#666]">{s.location ?? '—'}</td>
                        <td className="px-4 py-3">
                          <code className="text-xs text-[#888] font-mono bg-[#1a1a1a] px-1.5 py-0.5 rounded">{s.epc_tag}</code>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-green-400 font-bold text-sm">${Number(s.price_paid).toFixed(2)}</span>
                        </td>
                        <td className="px-4 py-3 text-[#555] text-xs max-w-[160px] truncate">{s.notes ?? '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {filtered.length > 0 && (
              <div className="px-4 py-2.5 border-t border-[#1a1a1a] bg-[#0d0d0d] text-xs text-[#444] flex items-center justify-between">
                <span>
                  Showing <strong className="text-white">{filtered.length}</strong> sales ·
                  Total <strong className="text-green-400">${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </span>
                {search && (
                  <button onClick={() => setSearch('')} className="text-[#444] hover:text-white transition-colors">
                    Clear search
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
