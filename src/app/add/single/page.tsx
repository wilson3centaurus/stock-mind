'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import StatusBadge from '@/components/StatusBadge';
import SelectOrAdd from '@/components/SelectOrAdd';
import { useSettings } from '@/hooks/useSettings';
import { BookCopyWithMaster } from '@/types';
import { Scan, CheckCircle2, XCircle, Loader2, Radio, Smartphone, Wifi } from 'lucide-react';

type Phase = 'waiting' | 'checking' | 'already_exists' | 'new_tag' | 'saving' | 'saved' | 'error';

interface FormData {
  title: string;
  isbn: string;
  category: string;
  location: string;
}

export default function SingleAddPage() {
  const supabase = createClient();
  const { categories, locations, addCategory, addLocation } = useSettings();
  const [phase, setPhase] = useState<Phase>('waiting');
  const [epc, setEpc] = useState('');
  const [existingCopy, setExistingCopy] = useState<BookCopyWithMaster | null>(null);
  const [form, setForm] = useState<FormData>({ title: '', isbn: '', category: '', location: '' });
  const [error, setError] = useState('');

  // Handheld push state
  const [handheldConnected, setHandheldConnected] = useState(false);
  const [lastHandheldFlash, setLastHandheldFlash] = useState(false);
  const wedgeInputRef = useRef<HTMLInputElement>(null);
  const phaseRef = useRef<Phase>('waiting');

  // Keep phaseRef in sync so the Realtime callback can read it without stale closures
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const handleEpc = useCallback(async (scannedEpc: string) => {
    const trimmed = scannedEpc.trim();
    if (!trimmed) return;
    setEpc(trimmed);
    setError('');
    setPhase('checking');

    const { data, error: dbErr } = await supabase
      .from('book_copies')
      .select('*, books_master(*)')
      .eq('epc_tag', trimmed)
      .maybeSingle();

    if (dbErr) { setError(dbErr.message); setPhase('error'); return; }

    if (data) {
      setExistingCopy(data as BookCopyWithMaster);
      setPhase('already_exists');
    } else {
      setExistingCopy(null);
      setPhase('new_tag');
    }
  }, [supabase]);

  // ── Keyboard wedge (direct USB / Bluetooth) ──────────────────
  useEffect(() => {
    window.onRFIDScan = handleEpc;
  }, [handleEpc]);

  // ── Realtime broadcast from handheld app ─────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('rfid-scan')
      .on('broadcast', { event: 'epc_scanned' }, ({ payload }) => {
        const incoming = payload?.epc as string | undefined;
        if (!incoming) return;
        setHandheldConnected(true);
        setLastHandheldFlash(true);
        setTimeout(() => setLastHandheldFlash(false), 1500);
        // Only auto-fill if we are idle
        const current = phaseRef.current;
        if (current === 'waiting' || current === 'saved' || current === 'error') {
          handleEpc(incoming);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setHandheldConnected(true);
      });

    return () => { supabase.removeChannel(channel); };
  }, [supabase, handleEpc]);

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Book title is required.'); return; }
    setPhase('saving');
    setError('');

    // Upsert books_master
    const { data: book, error: bookErr } = await supabase
      .from('books_master')
      .upsert({ title: form.title.trim(), isbn: form.isbn || null, category: form.category || null }, { onConflict: 'id' })
      .select()
      .single();

    if (bookErr || !book) { setError(bookErr?.message ?? 'Failed to save book.'); setPhase('error'); return; }

    // Insert book_copy
    const { error: copyErr } = await supabase.from('book_copies').insert({
      book_id: book.id,
      epc_tag: epc,
      location: form.location || null,
      status: 'in_stock',
      date_added: new Date().toISOString(),
    });

    if (copyErr) { setError(copyErr.message); setPhase('error'); return; }
    setPhase('saved');
  };

  const reset = () => {
    setPhase('waiting');
    setEpc('');
    setExistingCopy(null);
    setForm({ title: '', isbn: '', category: '', location: '' });
    setError('');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-white">Single Add</h1>
            <p className="text-sm text-[#555] mt-0.5">Scan one RFID tag and register it to a book</p>
          </div>
          {/* Handheld push status */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-500 shrink-0 ${
            lastHandheldFlash
              ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
              : handheldConnected
              ? 'border-blue-500/30 bg-blue-500/5 text-blue-400'
              : 'border-[#2a2a2a] bg-[#111] text-[#444]'
          }`}>
            {lastHandheldFlash
              ? <Smartphone size={12} className="animate-bounce" />
              : handheldConnected
              ? <Wifi size={12} />
              : <Wifi size={12} className="opacity-40" />
            }
            {lastHandheldFlash ? 'EPC received!' : handheldConnected ? 'Handheld ready' : 'Listening…'}
          </div>
        </div>

        {/* Scan area */}
        <div className={`border rounded-xl p-6 mb-6 transition-colors ${
          phase === 'waiting'
            ? 'border-[#2a2a2a] bg-[#161616]'
            : phase === 'already_exists'
            ? 'border-amber-500/30 bg-amber-500/5'
            : phase === 'saved'
            ? 'border-emerald-500/30 bg-emerald-500/5'
            : phase === 'error'
            ? 'border-red-500/30 bg-red-500/5'
            : 'border-blue-500/30 bg-blue-500/5'
        }`}>
          <div className="flex items-center gap-3 mb-4">
            {phase === 'waiting' && <Radio size={18} className="text-[#555] scan-pulse" />}
            {phase === 'checking' && <Loader2 size={18} className="text-blue-400 animate-spin" />}
            {phase === 'already_exists' && <CheckCircle2 size={18} className="text-amber-400" />}
            {phase === 'new_tag' && <Scan size={18} className="text-white" />}
            {phase === 'saving' && <Loader2 size={18} className="text-white animate-spin" />}
            {phase === 'saved' && <CheckCircle2 size={18} className="text-emerald-400" />}
            {phase === 'error' && <XCircle size={18} className="text-red-400" />}
            <div>
              <div className="text-sm font-medium text-white">
                {phase === 'waiting' && 'Waiting for scan…'}
                {phase === 'checking' && 'Checking database…'}
                {phase === 'already_exists' && 'Tag already registered'}
                {phase === 'new_tag' && 'New tag detected'}
                {phase === 'saving' && 'Saving…'}
                {phase === 'saved' && 'Successfully saved!'}
                {phase === 'error' && 'Error occurred'}
              </div>
              {epc && (
                <code className="text-xs text-[#666] font-mono">{epc}</code>
              )}
            </div>
          </div>

          {/* Already exists — show info */}
          {phase === 'already_exists' && existingCopy && (
            <div className="space-y-2 mt-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-[#555] text-xs">Title</span>
                  <div className="text-white font-medium">{existingCopy.books_master?.title}</div>
                </div>
                <div>
                  <span className="text-[#555] text-xs">Status</span>
                  <div className="mt-0.5"><StatusBadge status={existingCopy.status} /></div>
                </div>
                <div>
                  <span className="text-[#555] text-xs">ISBN</span>
                  <div className="text-[#888] font-mono text-xs">{existingCopy.books_master?.isbn ?? '—'}</div>
                </div>
                <div>
                  <span className="text-[#555] text-xs">Location</span>
                  <div className="text-[#888]">{existingCopy.location ?? '—'}</div>
                </div>
              </div>
              <button onClick={reset} className="mt-4 w-full py-2 rounded-lg border border-[#2a2a2a] text-sm text-[#888] hover:text-white hover:border-[#3a3a3a] transition-colors">
                Scan another tag
              </button>
            </div>
          )}

          {/* Success */}
          {phase === 'saved' && (
            <div className="mt-4">
              <button onClick={reset} className="w-full py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-[#e6e6e6] transition-colors">
                Scan another tag
              </button>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg border border-red-500/30 bg-red-500/5 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* NEW TAG — Register form */}
        {phase === 'new_tag' && (
          <div className="border border-[#2a2a2a] rounded-xl p-6 bg-[#161616] slide-in">
            <h2 className="text-sm font-semibold text-white mb-4">Register New Tag</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-[#555] font-medium block mb-1.5">Book Title <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Graham Computer Science"
                  className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#555]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#555] font-medium block mb-1.5">ISBN</label>
                  <input
                    type="text"
                    value={form.isbn}
                    onChange={(e) => setForm({ ...form, isbn: e.target.value })}
                    placeholder="978-3-16-148410-0"
                    className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#555]"
                  />
                </div>
                <SelectOrAdd
                  label="Category"
                  value={form.category}
                  onChange={(v) => setForm({ ...form, category: v === '__other__' ? '' : v })}
                  options={categories}
                  onAddNew={(v) => { addCategory(v); setForm((f) => ({ ...f, category: v })); }}
                  placeholder="Select category…"
                />
              </div>
              <SelectOrAdd
                label="Location / Shelf"
                value={form.location}
                onChange={(v) => setForm({ ...form, location: v === '__other__' ? '' : v })}
                options={locations}
                onAddNew={(v) => { addLocation(v); setForm((f) => ({ ...f, location: v })); }}
                placeholder="Select location…"
              />
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  className="flex-1 py-2.5 rounded-lg bg-white text-black text-sm font-semibold hover:bg-[#e6e6e6] transition-colors"
                >
                  Save to Inventory
                </button>
                <button
                  onClick={reset}
                  className="px-4 py-2.5 rounded-lg border border-[#2a2a2a] text-sm text-[#888] hover:text-white hover:border-[#3a3a3a] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Keyboard wedge input — tap here, then scan with handheld (USB/BT direct) */}
        {(phase === 'waiting' || phase === 'error') && (
          <div className="border border-[#2a2a2a] rounded-xl p-5 bg-[#161616] mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-[#555] font-medium uppercase tracking-wider">Keyboard Wedge / Manual Entry</div>
              <div className="flex items-center gap-1.5 text-[10px] text-[#333]">
                <Smartphone size={10} className="text-blue-400" />
                <span className="text-blue-400">Or scan from the handheld app — EPC will appear automatically</span>
              </div>
            </div>
            <input
              ref={wedgeInputRef}
              type="text"
              autoComplete="off"
              placeholder="Tap here, then pull trigger on handheld (USB/BT)…"
              className="w-full bg-[#0d0d0d] border border-emerald-500/30 rounded-lg px-3 py-2.5 text-sm text-white placeholder-[#555] focus:outline-none focus:border-emerald-500/60 font-mono caret-emerald-400"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value.trim();
                  if (val) { handleEpc(val); (e.target as HTMLInputElement).value = ''; }
                  e.preventDefault();
                }
              }}
            />
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
