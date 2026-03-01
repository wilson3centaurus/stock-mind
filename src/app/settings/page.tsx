'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useSettings } from '@/hooks/useSettings';
import { Settings, MapPin, Tag, Plus, Trash2, AlertCircle } from 'lucide-react';

function TagList({
  items,
  onRemove,
  color = 'blue',
}: {
  items: string[];
  onRemove: (v: string) => void;
  color?: 'blue' | 'purple';
}) {
  const accent = color === 'purple' ? 'bg-purple-500/10 border-purple-500/20 text-purple-300' : 'bg-blue-500/10 border-blue-500/20 text-blue-300';
  const btnAccent = color === 'purple' ? 'hover:text-purple-400' : 'hover:text-blue-400';

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 text-[#444] text-sm py-3">
        <AlertCircle size={14} />
        <span>No items yet — add one below.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className={`inline-flex items-center gap-1.5 border rounded-lg px-3 py-1.5 text-sm ${accent}`}
        >
          {item}
          <button
            onClick={() => onRemove(item)}
            className={`text-[#666] ${btnAccent} transition-colors ml-1`}
            title={`Remove "${item}"`}
          >
            <Trash2 size={11} />
          </button>
        </span>
      ))}
    </div>
  );
}

function AddItemInput({
  onAdd,
  placeholder,
}: {
  onAdd: (v: string) => void;
  placeholder: string;
}) {
  const [val, setVal] = useState('');

  const commit = () => {
    const t = val.trim();
    if (!t) return;
    onAdd(t);
    setVal('');
  };

  return (
    <div className="flex gap-2 mt-4">
      <input
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
        placeholder={placeholder}
        className="flex-1 bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#555] transition-colors"
      />
      <button
        onClick={commit}
        disabled={!val.trim()}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-black text-sm font-semibold hover:bg-[#e6e6e6] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Plus size={14} />
        Add
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const { categories, locations, addCategory, removeCategory, addLocation, removeLocation, ready } = useSettings();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center">
            <Settings size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Settings</h1>
            <p className="text-sm text-[#555] mt-0.5">Manage dropdown options for categories and locations</p>
          </div>
        </div>

        {!ready ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-40 bg-[#161616] border border-[#2a2a2a] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Categories */}
            <section className="bg-[#111] border border-[#2a2a2a] rounded-xl p-6">
              <div className="flex items-center gap-2.5 mb-1">
                <Tag size={15} className="text-blue-400" />
                <h2 className="text-base font-semibold text-white">Categories</h2>
                <span className="ml-auto text-xs text-[#555] bg-[#1e1e1e] px-2 py-0.5 rounded-md">{categories.length}</span>
              </div>
              <p className="text-xs text-[#555] mb-5">
                These appear as dropdown options in the Category field when adding books.
              </p>
              <TagList items={categories} onRemove={removeCategory} color="blue" />
              <AddItemInput onAdd={addCategory} placeholder="e.g. Computer Science" />
            </section>

            {/* Locations */}
            <section className="bg-[#111] border border-[#2a2a2a] rounded-xl p-6">
              <div className="flex items-center gap-2.5 mb-1">
                <MapPin size={15} className="text-purple-400" />
                <h2 className="text-base font-semibold text-white">Locations</h2>
                <span className="ml-auto text-xs text-[#555] bg-[#1e1e1e] px-2 py-0.5 rounded-md">{locations.length}</span>
              </div>
              <p className="text-xs text-[#555] mb-5">
                These appear as dropdown options in the Location / Shelf field when adding books.
              </p>
              <TagList items={locations} onRemove={removeLocation} color="purple" />
              <AddItemInput onAdd={addLocation} placeholder="e.g. Shelf A3" />
            </section>

            <p className="text-xs text-[#444] text-center pb-4">
              Settings are saved in your browser. They will persist across sessions on this device.
            </p>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
