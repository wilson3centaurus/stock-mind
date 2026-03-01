'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BookCopyWithMaster } from '@/types';
import Image from 'next/image';
import Link from 'next/link';
import {
  Scan, Layers, CheckCircle2, XCircle, Loader2,
  Radio, Trash2, StopCircle, ArrowLeft, LayoutDashboard,
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';

// ─── Types ────────────────────────────────────────────────────
type AppMode = 'home' | 'single' | 'bulk';
type SinglePhase = 'waiting' | 'checking' | 'exists' | 'new_tag' | 'saving' | 'saved' | 'error';
interface ScannedTag { epc: string; at: Date; }

// ─── Shared input style ────────────────────────────────────────
const inp = 'w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#555] transition-colors';
const btn = (variant: 'primary' | 'ghost' | 'danger' = 'primary', extra = '') =>
  `flex items-center justify-center gap-2 rounded-xl font-semibold text-sm transition-colors ${extra} ${
    variant === 'primary' ? 'bg-white text-black hover:bg-[#e6e6e6]' :
    variant === 'danger'  ? 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20' :
    'border border-[#2a2a2a] text-[#888] hover:text-white hover:border-[#3a3a3a]'
  }`;

// ═══════════════════════════════════════════════════════════════
export default function ScanPage() {
  const [mode, setMode] = useState<AppMode>('home');

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-[#e6e6e6] flex flex-col max-w-md mx-auto">
      {mode === 'home'   && <HomeScreen onSelect={setMode} />}
      {mode === 'single' && <SingleMode onBack={() => setMode('home')} />}
      {mode === 'bulk'   && <BulkMode   onBack={() => setMode('home')} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HOME SCREEN
// ═══════════════════════════════════════════════════════════════
function HomeScreen({ onSelect }: { onSelect: (m: AppMode) => void }) {
  return (
    <div className="flex flex-col min-h-screen px-5 pt-10 pb-8">
      {/* Brand */}
      <div className="flex items-center gap-3 mb-10">
        <div className="w-9 h-9 relative rounded-lg overflow-hidden border border-[#2a2a2a]">
          <Image src="/robokorda-logo.jpg" alt="RoboKorda" fill className="object-contain" />
        </div>
        <div>
          <div className="text-white font-bold text-lg leading-none">StockMind</div>
          <div className="text-[#444] text-xs mt-0.5">RFID Scanner</div>
        </div>
      </div>

      {/* Mode cards */}
      <div className="flex-1 flex flex-col gap-4">
        <button
          onClick={() => onSelect('single')}
          className="w-full text-left bg-[#161616] border border-[#2a2a2a] rounded-2xl p-5 hover:border-[#3a3a3a] active:scale-[0.98] transition-all"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center">
              <Scan size={18} className="text-white" />
            </div>
            <span className="text-[10px] text-[#444] border border-[#222] rounded px-2 py-0.5 font-medium uppercase tracking-wider">Single</span>
          </div>
          <div className="text-white font-semibold text-base mb-1">Single Add</div>
          <div className="text-[#555] text-sm leading-relaxed">
            Scan one tag → check if it exists → fill in book details if new
          </div>
        </button>

        <button
          onClick={() => onSelect('bulk')}
          className="w-full text-left bg-[#161616] border border-[#2a2a2a] rounded-2xl p-5 hover:border-[#3a3a3a] active:scale-[0.98] transition-all"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center">
              <Layers size={18} className="text-white" />
            </div>
            <span className="text-[10px] text-[#444] border border-[#222] rounded px-2 py-0.5 font-medium uppercase tracking-wider">Bulk</span>
          </div>
          <div className="text-white font-semibold text-base mb-1">Bulk Add</div>
          <div className="text-[#555] text-sm leading-relaxed">
            Enter a book title → scan a stack of copies → confirm all at once
          </div>
        </button>
      </div>

      {/* Footer link to dashboard */}
      <div className="mt-8 pt-6 border-t border-[#1a1a1a]">
        <Link
          href="/"
          className="flex items-center gap-2 text-xs text-[#444] hover:text-[#888] transition-colors"
        >
          <LayoutDashboard size={13} />
          Open Dashboard
        </Link>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SINGLE MODE
// ═══════════════════════════════════════════════════════════════
function SingleMode({ onBack }: { onBack: () => void }) {
  const supabase = createClient();
  const [phase, setPhase] = useState<SinglePhase>('waiting');
  const [epc, setEpc] = useState('');
  const [existing, setExisting] = useState<BookCopyWithMaster | null>(null);
  const [form, setForm] = useState({ title: '', isbn: '', category: '', location: '' });
  const [error, setError] = useState('');
  const [scanInput, setScanInput] = useState('');
  const bufferRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Only accept keystrokes when NOT filling a form field
  const acceptingScans = phase === 'waiting' || phase === 'error';

  const handleEpc = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setEpc(trimmed);
    setError('');
    setPhase('checking');

    const { data, error: e } = await supabase
      .from('book_copies').select('*, books_master(*)')
      .eq('epc_tag', trimmed).maybeSingle();

    if (e) { setError(e.message); setPhase('error'); return; }
    if (data) { setExisting(data as BookCopyWithMaster); setPhase('exists'); }
    else { setExisting(null); setPhase('new_tag'); }

    // ── Broadcast to PC dashboard so /add/single auto-fills ──
    supabase.channel('rfid-scan').send({
      type: 'broadcast',
      event: 'epc_scanned',
      payload: { epc: trimmed, from: 'handheld' },
    });
  }, [supabase]);

  // DataWedge Keystroke output — fires at document level, not into an input
  useEffect(() => {
    const flushBuffer = () => {
      const val = bufferRef.current.trim();
      bufferRef.current = '';
      if (val.length >= 4) handleEpc(val);
    };
    const onKey = (e: KeyboardEvent) => {
      // Ignore if a real input/textarea is focused (user is typing a form)
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (!acceptingScans) return;
      if (['Shift','Control','Alt','Meta','CapsLock','Tab','Escape','Unidentified'].includes(e.key)) return;
      if (e.key === 'Enter') {
        if (timerRef.current) clearTimeout(timerRef.current);
        flushBuffer(); e.preventDefault(); return;
      }
      if (e.key.length === 1) {
        bufferRef.current += e.key;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(flushBuffer, 120);
      }
    };
    document.addEventListener('keydown', onKey);
    // Also support WebView SDK bridge
    window.onRFIDScan = (epc: string) => { if (acceptingScans) handleEpc(epc); };
    return () => document.removeEventListener('keydown', onKey);
  }, [handleEpc, acceptingScans]);

  // Handle keyboard wedge input (Chainway C72 types EPC into focused input)
  const handleScanInputChange = (val: string) => {
    setScanInput(val);
    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    if (val.length >= 8 && /^[0-9A-Fa-f]+$/.test(val)) {
      scanTimerRef.current = setTimeout(() => {
        if (val.trim().length >= 8) { handleEpc(val.trim()); setScanInput(''); }
      }, 300);
    }
  };
  const handleScanInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && scanInput.trim().length >= 4) {
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
      handleEpc(scanInput.trim()); setScanInput('');
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setPhase('saving');
    const { data: book, error: bErr } = await supabase
      .from('books_master')
      .insert({ title: form.title.trim(), isbn: form.isbn || null, category: form.category || null })
      .select().single();
    if (bErr || !book) { setError(bErr?.message ?? 'Failed to save book.'); setPhase('error'); return; }
    const { error: cErr } = await supabase.from('book_copies').insert({
      book_id: book.id, epc_tag: epc,
      location: form.location || null, status: 'in_stock',
    });
    if (cErr) { setError(cErr.message); setPhase('error'); return; }
    setPhase('saved');
  };

  const reset = () => {
    setPhase('waiting'); setEpc(''); setScanInput('');
    setExisting(null); setForm({ title: '', isbn: '', category: '', location: '' }); setError('');
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-8 pb-6">
        <button onClick={onBack} className="w-8 h-8 rounded-lg border border-[#2a2a2a] flex items-center justify-center text-[#666] hover:text-white transition-colors">
          <ArrowLeft size={15} />
        </button>
        <div>
          <div className="text-white font-semibold">Single Add</div>
          <div className="text-[#444] text-xs">Scan → identify → register</div>
        </div>
      </div>

      <div className="flex-1 px-5 pb-8 space-y-4">
        {/* Scan status card */}
        <div className={`rounded-2xl p-5 border transition-colors ${
          phase === 'waiting'  ? 'border-[#2a2a2a] bg-[#161616]' :
          phase === 'exists'   ? 'border-amber-500/30 bg-amber-500/5' :
          phase === 'saved'    ? 'border-emerald-500/30 bg-emerald-500/5' :
          phase === 'error'    ? 'border-red-500/30 bg-red-500/5' :
          'border-blue-500/30 bg-blue-500/5'
        }`}>
          <div className="flex items-center gap-3">
            {phase === 'waiting'  && <Radio size={20} className="text-[#444] scan-pulse" />}
            {phase === 'checking' && <Loader2 size={20} className="text-blue-400 animate-spin" />}
            {phase === 'exists'   && <CheckCircle2 size={20} className="text-amber-400" />}
            {phase === 'new_tag'  && <Scan size={20} className="text-white" />}
            {phase === 'saving'   && <Loader2 size={20} className="text-white animate-spin" />}
            {phase === 'saved'    && <CheckCircle2 size={20} className="text-emerald-400" />}
            {phase === 'error'    && <XCircle size={20} className="text-red-400" />}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white">
                {phase === 'waiting'  && 'Ready — pull trigger to scan'}
                {phase === 'checking' && 'Checking database…'}
                {phase === 'exists'   && 'Already registered'}
                {phase === 'new_tag'  && 'New tag — fill details below'}
                {phase === 'saving'   && 'Saving…'}
                {phase === 'saved'    && 'Saved to inventory!'}
                {phase === 'error'    && 'Error'}
              </div>
              {epc && <code className="text-xs text-[#555] font-mono truncate block mt-0.5">{epc}</code>}
            </div>
          </div>

          {/* Existing copy details */}
          {phase === 'exists' && existing && (
            <div className="mt-4 space-y-3 border-t border-[#2a2a2a] pt-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><div className="text-[#444] text-xs mb-0.5">Title</div><div className="text-white font-medium leading-tight">{existing.books_master?.title}</div></div>
                <div><div className="text-[#444] text-xs mb-0.5">Status</div><div className="mt-0.5"><StatusBadge status={existing.status} /></div></div>
                <div><div className="text-[#444] text-xs mb-0.5">Category</div><div className="text-[#888]">{existing.books_master?.category ?? '—'}</div></div>
                <div><div className="text-[#444] text-xs mb-0.5">Location</div><div className="text-[#888]">{existing.location ?? '—'}</div></div>
              </div>
              <button onClick={reset} className={`${btn('ghost')} w-full py-3 mt-2`}>Scan another</button>
            </div>
          )}

          {/* Saved */}
          {phase === 'saved' && (
            <button onClick={reset} className={`${btn('primary')} w-full py-3 mt-4`}>Scan another</button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/5 text-red-400 text-sm">{error}</div>
        )}

        {/* Register form */}
        {phase === 'new_tag' && (
          <div className="border border-[#2a2a2a] rounded-2xl p-5 bg-[#161616] space-y-4 slide-in">
            <div className="text-sm font-semibold text-white">Register this tag</div>
            <div>
              <label className="text-xs text-[#444] font-medium block mb-1.5">Title <span className="text-red-400">*</span></label>
              <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Graham Computer Science" className={inp} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#444] font-medium block mb-1.5">ISBN</label>
                <input type="text" value={form.isbn} onChange={e => setForm({...form, isbn: e.target.value})} placeholder="978-…" className={inp} />
              </div>
              <div>
                <label className="text-xs text-[#444] font-medium block mb-1.5">Category</label>
                <input type="text" value={form.category} onChange={e => setForm({...form, category: e.target.value})} placeholder="Science" className={inp} />
              </div>
            </div>
            <div>
              <label className="text-xs text-[#444] font-medium block mb-1.5">Location / Shelf</label>
              <input type="text" value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="e.g. Shelf A3" className={inp} />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={handleSave} className={`${btn('primary')} flex-1 py-3`}>Save to Inventory</button>
              <button onClick={reset} className={`${btn('ghost')} px-4 py-3`}>Cancel</button>
            </div>
          </div>
        )}

        {/* RFID scan input — keyboard wedge types EPC here */}
        {(phase === 'waiting' || phase === 'error') && (
          <div className="border border-emerald-500/20 rounded-2xl p-4 bg-emerald-500/5">
            <div className="text-emerald-400 text-xs font-semibold mb-3">📱 Tap here, then pull the trigger</div>
            <input
              ref={scanInputRef}
              type="text" value={scanInput}
              onChange={e => handleScanInputChange(e.target.value)}
              onKeyDown={handleScanInputKeyDown}
              placeholder="Tap to focus → then scan…"
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-4 text-white font-mono text-base placeholder:text-[#333] focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
              autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
            />
            {scanInput && <div className="text-[#555] text-xs mt-2">Receiving: <code className="text-white font-bold">{scanInput}</code></div>}
            <button onClick={() => scanInputRef.current?.focus()} className="w-full mt-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold active:bg-emerald-500/20">
              Tap to Focus
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BULK MODE — scan only, details entered on PC dashboard
// ═══════════════════════════════════════════════════════════════
function BulkMode({ onBack }: { onBack: () => void }) {
  const supabase = createClient();
  const [isScanning, setIsScanning] = useState(false);
  const [tags, setTags] = useState<ScannedTag[]>([]);
  const epcSet = useRef<Set<string>>(new Set());
  const scanInputRef = useRef<HTMLInputElement>(null);
  const [scanInput, setScanInput] = useState('');
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bufferRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [broadcastCount, setBroadcastCount] = useState(0);
  const [flashEpc, setFlashEpc] = useState('');

  const handleEpc = useCallback((raw: string) => {
    const trimmed = raw.trim().toUpperCase();
    if (!trimmed || epcSet.current.has(trimmed)) return;
    epcSet.current.add(trimmed);
    setTags((prev) => [{ epc: trimmed, at: new Date() }, ...prev]);

    // Broadcast to PC dashboard /add/bulk
    supabase.channel('rfid-bulk').send({
      type: 'broadcast',
      event: 'bulk_epc',
      payload: { epc: trimmed, from: 'handheld' },
    });

    setBroadcastCount((n) => n + 1);
    setFlashEpc(trimmed);
    setTimeout(() => setFlashEpc(''), 1000);
  }, [supabase]);

  // DataWedge / document-level keystroke
  useEffect(() => {
    const flushBuffer = () => {
      const val = bufferRef.current.trim();
      bufferRef.current = '';
      if (val.length >= 4) handleEpc(val);
    };
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (!isScanning) return;
      if (['Shift','Control','Alt','Meta','CapsLock','Tab','Escape','Unidentified'].includes(e.key)) return;
      if (e.key === 'Enter') {
        if (timerRef.current) clearTimeout(timerRef.current);
        flushBuffer(); e.preventDefault(); return;
      }
      if (e.key.length === 1) {
        bufferRef.current += e.key;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(flushBuffer, 120);
      }
    };
    document.addEventListener('keydown', onKey);
    window.onRFIDScan = (epc: string) => { if (isScanning) handleEpc(epc); };
    return () => document.removeEventListener('keydown', onKey);
  }, [handleEpc, isScanning]);

  // Keyboard wedge input field
  const handleScanInputChange = (val: string) => {
    setScanInput(val);
    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    if (val.length >= 8 && /^[0-9A-Fa-f]+$/i.test(val)) {
      scanTimerRef.current = setTimeout(() => {
        if (val.trim().length >= 4) { handleEpc(val.trim()); setScanInput(''); }
      }, 300);
    }
  };
  const handleScanInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && scanInput.trim().length >= 4) {
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
      handleEpc(scanInput.trim()); setScanInput('');
    }
  };

  const reset = () => {
    setTags([]); epcSet.current.clear();
    setBroadcastCount(0); setFlashEpc('');
    setIsScanning(false); setScanInput('');
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-8 pb-4">
        <button onClick={onBack} className="w-8 h-8 rounded-lg border border-[#2a2a2a] flex items-center justify-center text-[#666] hover:text-white transition-colors">
          <ArrowLeft size={15} />
        </button>
        <div>
          <div className="text-white font-semibold">Bulk Scan</div>
          <div className="text-[#444] text-xs">Scan tags → sent live to PC dashboard</div>
        </div>
        {broadcastCount > 0 && (
          <span className="ml-auto text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full font-medium">
            {broadcastCount} sent
          </span>
        )}
      </div>

      <div className="flex-1 px-5 pb-8 space-y-4">
        {/* PC instruction banner */}
        <div className="border border-[#2a2a2a] bg-[#111] rounded-2xl p-4 flex items-start gap-3">
          <LayoutDashboard size={16} className="text-blue-400 mt-0.5 shrink-0" />
          <div>
            <div className="text-white text-sm font-semibold">Book details entered on PC</div>
            <div className="text-[#555] text-xs mt-0.5 leading-relaxed">
              On the PC go to <strong className="text-white">Bulk Add</strong> and click <strong className="text-white">Start Scanning</strong>. Tags you scan here will appear there instantly.
            </div>
          </div>
        </div>

        {/* Scan toggle */}
        <button
          onClick={() => { setIsScanning((s) => !s); if (!isScanning) setTimeout(() => scanInputRef.current?.focus(), 100); }}
          className={`w-full py-5 rounded-2xl font-bold text-base transition-all active:scale-[0.98] flex items-center justify-center gap-3 ${
            isScanning
              ? 'bg-red-500/10 border border-red-500/30 text-red-400'
              : 'bg-white text-black hover:bg-[#e6e6e6]'
          }`}
        >
          {isScanning ? <StopCircle size={20} /> : <Scan size={20} />}
          {isScanning ? 'Stop Scanning' : 'Start Scanning'}
        </button>

        {/* Live flash */}
        {flashEpc && (
          <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-2xl px-4 py-3 flex items-center gap-3 fade-in">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <div>
              <div className="text-emerald-400 text-sm font-semibold">Sent to dashboard!</div>
              <code className="text-[#555] text-xs font-mono">{flashEpc}</code>
            </div>
          </div>
        )}

        {/* Scan input (keyboard wedge / Chainway) */}
        {isScanning && (
          <div className="border border-blue-500/20 rounded-2xl p-4 bg-blue-500/5">
            <div className="text-blue-400 text-xs font-semibold mb-3">📱 Tap here, then pull trigger</div>
            <input
              ref={scanInputRef}
              type="text"
              value={scanInput}
              onChange={(e) => handleScanInputChange(e.target.value)}
              onKeyDown={handleScanInputKeyDown}
              placeholder="Tap to focus → scan tags…"
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-xl px-4 py-4 text-white font-mono text-base placeholder:text-[#333] focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
              autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
            />
            {scanInput && <div className="text-[#555] text-xs mt-2">Receiving: <code className="text-white font-bold">{scanInput}</code></div>}
            <button onClick={() => scanInputRef.current?.focus()} className="w-full mt-3 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold active:bg-blue-500/20">
              Tap to Focus
            </button>
          </div>
        )}

        {/* Tags scanned list */}
        {tags.length > 0 && (
          <div className="border border-[#2a2a2a] rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1a1a1a] bg-[#111] flex justify-between items-center">
              <span className="text-xs text-[#555] font-medium uppercase tracking-wider">Scanned</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-white font-bold">{tags.length}</span>
                <button onClick={reset} className="text-[#333] hover:text-red-400 text-xs transition-colors flex items-center gap-1">
                  <Trash2 size={11} /> Clear
                </button>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-[#1a1a1a]">
              {tags.map((tag) => (
                <div key={tag.epc} className="flex items-center gap-3 px-4 py-3 slide-in">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                  <code className="text-xs text-[#888] font-mono flex-1 truncate">{tag.epc}</code>
                  <span className="text-[10px] text-[#333] shrink-0">{tag.at.toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tags.length === 0 && !isScanning && (
          <div className="text-center py-10 text-[#333] text-sm">
            Press <strong className="text-white">Start Scanning</strong> and scan your tags.
          </div>
        )}
      </div>
    </div>
  );
}


