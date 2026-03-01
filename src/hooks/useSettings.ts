/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useState, useEffect, useCallback } from 'react';

const CATEGORIES_KEY = 'stockmind_categories';
const LOCATIONS_KEY  = 'stockmind_locations';

const DEFAULT_CATEGORIES = ['Computer Science', 'Mathematics', 'Physics', 'Biology', 'Chemistry', 'English', 'History', 'Geography'];
const DEFAULT_LOCATIONS  = ['Shelf A1', 'Shelf A2', 'Shelf B1', 'Shelf B2', 'Store Room'];

function load(key: string, defaults: string[]): string[] {
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : defaults;
  } catch {
    return defaults;
  }
}

function save(key: string, value: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function useSettings() {
  const [categories, setCategories] = useState<string[]>([]);
  const [locations,  setLocations]  = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setCategories(load(CATEGORIES_KEY, DEFAULT_CATEGORIES));
    setLocations(load(LOCATIONS_KEY, DEFAULT_LOCATIONS));
    setReady(true);
  }, []);

  const addCategory = useCallback((cat: string) => {
    const trimmed = cat.trim();
    if (!trimmed) return;
    setCategories((prev) => {
      if (prev.includes(trimmed)) return prev;
      const next = [...prev, trimmed].sort((a, b) => a.localeCompare(b));
      save(CATEGORIES_KEY, next);
      return next;
    });
  }, []);

  const removeCategory = useCallback((cat: string) => {
    setCategories((prev) => {
      const next = prev.filter((c) => c !== cat);
      save(CATEGORIES_KEY, next);
      return next;
    });
  }, []);

  const addLocation = useCallback((loc: string) => {
    const trimmed = loc.trim();
    if (!trimmed) return;
    setLocations((prev) => {
      if (prev.includes(trimmed)) return prev;
      const next = [...prev, trimmed].sort((a, b) => a.localeCompare(b));
      save(LOCATIONS_KEY, next);
      return next;
    });
  }, []);

  const removeLocation = useCallback((loc: string) => {
    setLocations((prev) => {
      const next = prev.filter((l) => l !== loc);
      save(LOCATIONS_KEY, next);
      return next;
    });
  }, []);

  return { categories, locations, addCategory, removeCategory, addLocation, removeLocation, ready };
}
