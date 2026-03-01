'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SelectOrAdd from '@/components/SelectOrAdd';
import { useSettings } from '@/hooks/useSettings';
import { Layers, Scan, CheckCircle2, XCircle, Loader2, Trash2, Radio, StopCircle, Wifi, Smartphone } from 'lucide-react';

interface BulkForm {
  title: string;
  isbn: string;
  category: string;
  location: string;
}

interface ScannedTag {
  epc: string;
  scannedAt: Date;
  fromHandheld?: boolean;
}

type BulkPhase = 'setup' | 'scanning' | 'confirming' | 'done' | 'error';

export default function BulkAddPage() {
  const supabase = createClient();
  const { categories, locations, addCategory, addLocation } = useSettings();
  const [phase, setPhase] = useState<BulkPhase>('setup');
  const [form, setForm] = useState<BulkForm>({ title: '', isbn: '', category: '', location: '' });
  const [tags, setTags] = useState<ScannedTag[]>([]);
  const [formError, setFormError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [savedCount, setSavedCount] = useState(0);
  const epcSet = useRef<Set<string>>(new Set());

  // Handheld connection state
  const [handheldConnected, setHandheldConnected] = useState(false);
  const [lastFlash, setLastFlash] = useState(false);
  const phaseRef = useRef<BulkPhase>('setup');
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const handleEpc = useCallback((scannedEpc: string, fromHandheld = false) => {
    const trimmed = scannedEpc.trim();
    if (!trimmed || epcSet.current.has(trimmed)) return;
    epcSet.current.add(trimmed);
    setTags((prev) => [{ epc: trimmed, scannedAt: new Date(), fromHandheld }, ...prev]);
  }, []);

  // Keyboard wedge (USB/BT direct to PC)
  useEffect(() => {
    window.onRFIDScan = (epc: string) => handleEpc(epc, false);
  }, [handleEpc]);

  // Realtime broadcast from handheld app
  useEffect(() => {
    const channel = supabase
      .channel('rfid-bulk')
      .on('broadcast', { event: 'bulk_epc' }, ({ payload }) => {
        const incoming = payload?.epc as string | undefined;
        if (!incoming) return;
        setHandheldConnected(true);
        setLastFlash(true);
        setTimeout(() => setLastFlash(false), 800);
        if (phaseRef.current === 'scanning') {
          handleEpc(incoming, true);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setHandheldConnected(true);
      });
    return () => { supabase.removeChannel(channel); };
  }, [supabase, handleEpc]);

  const startScan = () => {
    if (!form.title.trim()) { setFormError('Book title is required to start scanning.'); return; }
    setFormError('');
    epcSet.current.clear();
    setTags([]);
    setPhase('scanning');
  };

  const stopScan = () => setPhase('confirming');

  const removeTag = (epc: string) => {
    epcSet.current.delete(epc);
    setTags((prev) => prev.filter((t) => t.epc !== epc));
  };

  const confirmAll = async () => {
    if (tags.length === 0) return;
    setPhase('confirming');
    setSaveError('');

    // 1. Insert / find book in books_master
    const { data: existing } = await supabase
      .from('books_master')
      .select('id')
      .eq('title', form.title.trim())
      .maybeSingle();

    let bookId: string;

    if (existing?.id) {
      bookId = existing.id;
    } else {
      const { data: newBook, error: bookErr } = await supabase
        .from('books_master')
        .insert({ title: form.title.trim(), isbn: form.isbn || null, category: form.category || null })
        .select('id')
        .single();
      if (bookErr || !newBook) {
        setSaveError(bookErr?.message ?? 'Failed to create book record.');
        setPhase('error');
        return;
      }
      bookId = newBook.id;
    }

    // 2. Bulk insert all copies
    const rows = tags.map((t) => ({
      book_id: bookId,
      epc_tag: t.epc,
      location: form.location || null,
      status: 'in_stock',
      date_added: new Date().toISOString(),
    }));

    const { error: copyErr } = await supabase.from('book_copies').insert(rows);
    if (copyErr) {
      setSaveError(copyErr.message);
      setPhase('error');
      return;
    }

    setSavedCount(rows.length);
    setPhase('done');
  };

  const reset = () => {
    setPhase('setup');
    setForm({ title: '', isbn: '', category: '', location: '' });
    setTags([]);
    epcSet.current.clear();
    setFormError('');
    setSaveError('');
    setSavedCount(0);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-white">Bulk Add</h1>
            <p className="text-sm text-[#555] mt-0.5">Enter book details here → scan stack with the handheld app</p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-500 shrink-0 ${
            lastFlash
              ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
              : handheldConnected
              ? 'border-blue-500/30 bg-blue-500/5 text-blue-400'
              : 'border-[#2a2a2a] bg-[#111] text-[#444]'
          }`}>
            {lastFlash
              ? <Smartphone size={12} className="animate-bounce" />
              : handheldConnected
              ? <Wifi size={12} />
              : <Wifi size={12} className="opacity-40" />
            }
            {lastFlash ? 'Tag received!' : handheldConnected ? 'Handheld ready' : 'Listening…'}
          </div>
        </div>

        {/* Done screen */}
        {phase === 'done' && (
          <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-xl p-8 text-center slide-in">
            <CheckCircle2 size={32} className="text-emerald-400 mx-auto mb-3" />
            <div className="text-white font-semibold text-lg mb-1">{savedCount} copies saved!</div>
            <div className="text-[#555] text-sm mb-6">
              All RFID tags have been linked to <span className="text-white">{form.title}</span>
            </div>
            <button onClick={reset} className="px-6 py-2.5 rounded-lg bg-white text-black text-sm font-semibold hover:bg-[#e6e6e6] transition-colors">
              Start new bulk scan
            </button>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div className="border border-red-500/30 bg-red-500/5 rounded-xl p-6 text-center slide-in">
            <XCircle size={28} className="text-red-400 mx-auto mb-3" />
            <div className="text-white font-semibold mb-1">Save failed</div>
            <div className="text-red-400 text-sm mb-4">{saveError}</div>
            <button onClick={() => setPhase('confirming')} className="px-5 py-2 rounded-lg border border-[#2a2a2a] text-sm text-[#888] hover:text-white transition-colors">
              Try again
            </button>
          </div>
        )}

        {/* Setup form */}
        {phase === 'setup' && (
          <div className="border border-[#2a2a2a] rounded-xl p-6 bg-[#161616]">
            <h2 className="text-sm font-semibold text-white mb-5 flex items-center gap-2">
              <Layers size={15} className="text-[#555]" />
              Step 1 — Enter book details
            </h2>
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
              {formError && (
                <div className="text-red-400 text-xs">{formError}</div>
              )}
              <button
                onClick={startScan}
                className="w-full py-2.5 rounded-lg bg-white text-black text-sm font-semibold hover:bg-[#e6e6e6] transition-colors flex items-center justify-center gap-2"
              >
                <Scan size={15} />
                Start Scanning
              </button>
            </div>
          </div>
        )}

        {/* Scanning / Confirming phase */}
        {(phase === 'scanning' || phase === 'confirming') && (
          <div className="space-y-4">
            {/* Book info summary */}
            <div className="border border-[#2a2a2a] rounded-xl p-4 bg-[#161616] flex items-center justify-between">
              <div>
                <div className="text-white font-medium text-sm">{form.title}</div>
                <div className="text-[#555] text-xs mt-0.5">
                  {form.category && <span>{form.category} · </span>}
                  {form.isbn && <span className="font-mono">{form.isbn}</span>}
                </div>
              </div>
              <button onClick={reset} className="text-xs text-[#444] hover:text-[#888] transition-colors">
                Change
              </button>
            </div>

            {/* Scan status bar */}
            <div className={`border rounded-xl p-4 flex items-center justify-between transition-colors ${
              phase === 'scanning'
                ? 'border-blue-500/30 bg-blue-500/5'
                : 'border-[#2a2a2a] bg-[#161616]'
            }`}>
              <div className="flex items-center gap-2.5">
                {phase === 'scanning'
                  ? <Radio size={16} className="text-blue-400 scan-pulse" />
                  : <StopCircle size={16} className="text-[#555]" />
                }
                <div>
                  <div className="text-sm font-medium text-white">
                    {phase === 'scanning' ? 'Scanning…' : 'Scan complete'}
                  </div>
                  <div className="text-xs text-[#555]">
                    {tags.length} tag{tags.length !== 1 ? 's' : ''} captured · duplicates auto-filtered
                  </div>
                </div>
              </div>
              {phase === 'scanning' ? (
                <button
                  onClick={stopScan}
                  className="px-3 py-1.5 rounded-lg border border-[#2a2a2a] text-xs text-[#888] hover:text-white hover:border-[#3a3a3a] transition-colors"
                >
                  Stop
                </button>
              ) : (
                <button
                  onClick={() => setPhase('scanning')}
                  className="px-3 py-1.5 rounded-lg border border-[#2a2a2a] text-xs text-[#888] hover:text-white hover:border-[#3a3a3a] transition-colors flex items-center gap-1"
                >
                  <Scan size={12} /> Resume
                </button>
              )}
            </div>

            {/* Handheld scanning hint */}
            {phase === 'scanning' && (
              <div className="border border-blue-500/20 rounded-xl p-4 bg-[#0d0d0d] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-blue-400 font-semibold">
                    <Smartphone size={13} />
                    Scan from handheld app
                  </div>
                  <div className={`flex items-center gap-1.5 text-xs font-medium ${
                    lastFlash ? 'text-emerald-400' : handheldConnected ? 'text-blue-400' : 'text-[#444]'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      lastFlash ? 'bg-emerald-400' : handheldConnected ? 'bg-blue-400' : 'bg-[#333]'
                    } ${lastFlash ? 'scan-pulse' : ''}`} />
                    {lastFlash ? 'Receiving…' : handheldConnected ? 'Connected' : 'Waiting for app'}
                  </div>
                </div>
                <p className="text-xs text-[#444]">Open the <strong className="text-white">StockMind app</strong> on the handheld → Bulk Add → start scanning. Each tag will appear here instantly.</p>
                <div className="border-t border-[#1a1a1a] pt-3">
                  <div className="text-xs text-[#555] mb-2 font-medium">Or use keyboard wedge directly (USB/BT):</div>
                  <input
                    type="text"
                    autoComplete="off"
                    placeholder="Tap here, then scan tags…"
                    className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-blue-500/40 font-mono"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val) { handleEpc(val, false); (e.target as HTMLInputElement).value = ''; }
                        e.preventDefault();
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {/* Tags list */}
            {tags.length > 0 && (
              <div className="border border-[#2a2a2a] rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-[#1a1a1a] bg-[#111] flex items-center justify-between">
                  <span className="text-xs text-[#555] font-medium uppercase tracking-wider">
                    Scanned Tags ({tags.length})
                  </span>
                  <span className="text-xs text-[#444]">All pending</span>
                </div>
                <div className="max-h-[320px] overflow-y-auto">
                  {tags.map((tag) => (
                    <div
                      key={tag.epc}
                      className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a1a1a] hover:bg-[#161616] transition-colors slide-in group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${tag.fromHandheld ? 'bg-blue-400' : 'bg-emerald-400'}`} />
                        <code className="text-xs text-[#888] font-mono">{tag.epc}</code>
                      </div>
                      <div className="flex items-center gap-3">
                        {tag.fromHandheld && (
                          <span className="text-[10px] text-blue-500 flex items-center gap-1">
                            <Smartphone size={9} />app
                          </span>
                        )}
                        <span className="text-[10px] text-[#444]">
                          {tag.scannedAt.toLocaleTimeString()}
                        </span>
                        <button
                          onClick={() => removeTag(tag.epc)}
                          className="opacity-0 group-hover:opacity-100 text-[#444] hover:text-red-400 transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Confirm button */}
            {phase === 'confirming' && tags.length > 0 && (
              <button
                onClick={confirmAll}
                className="w-full py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-[#e6e6e6] transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={16} />
                Confirm all {tags.length} tags — Save to Inventory
              </button>
            )}
          </div>
        )}

        {/* Saving overlay */}
        {phase === 'confirming' && tags.length === 0 && (
          <div className="flex items-center justify-center py-12 gap-3 text-[#555]">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Saving…</span>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
