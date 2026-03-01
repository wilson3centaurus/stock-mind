# StockMind — RFID Warehouse Inventory System

> A [RoboKorda](https://robokorda.com) initiative · *Making Robotics & Coding Fun*

StockMind is a full-stack RFID-based inventory system for tracking textbooks in a warehouse or school. It consists of:

- **Next.js web dashboard** — real-time inventory view, single add, bulk add
- **Supabase backend** — Postgres + Realtime subscriptions
- **Android WebView app** — thin wrapper that bridges UHF RFID scans into the web app

---

## Quick Start

### 1. Supabase Setup

1. Go to [supabase.com](https://supabase.com) → create a new project
2. Open **SQL Editor** and run the contents of `supabase/schema.sql`
3. Copy your **Project URL** and **Anon Key** from Project Settings → API

### 2. Web App Setup

```bash
# Install dependencies
npm install

# Edit .env.local with your Supabase credentials:
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Run locally
npm run dev
# → http://localhost:3000
```

### 3. Android App Setup

1. Open Android Studio → New Project → **Empty Activity**
2. Set package name: `com.robokorda.stockmind`
3. Copy files from `android-app/` into the appropriate paths:
   - `MainActivity.java` → `app/src/main/java/com/robokorda/stockmind/`
   - `AndroidManifest.xml` → `app/src/main/`
   - `build.gradle` → `app/`
4. Change `WEB_APP_URL` in `MainActivity.java` to your PC's local IP:
   ```java
   private static final String WEB_APP_URL = "http://192.168.1.XXX:3000";
   ```
5. Add your manufacturer's UHF RFID SDK `.aar` to `app/libs/`
6. Uncomment and adapt the SDK lines in `MainActivity.java`
7. Build & install APK onto the handheld

---

## Architecture

```
UHF Handheld Device
  └── Android App (WebView)
        └── loads http://YOUR_IP:3000
        └── on RFID scan → webView.evaluateJavascript(
              "window.onRFIDScan('EPC_VALUE')", null)

Next.js App (localhost:3000)
  ├── / → Dashboard (realtime table + stats)
  ├── /add/single → Scan 1 tag → fill form → save
  └── /add/bulk  → Enter title → scan N tags → confirm all

Supabase (Postgres + Realtime)
  ├── books_master (title, isbn, category)
  └── book_copies (epc_tag, book_id, status, location, date_added)
```

---

## Features

| Feature | Description |
|---|---|
| **Single Add** | Scan one EPC → check DB → if new: fill book details → save |
| **Bulk Add** | Enter book title → scan many EPCs → deduplicated in real-time → confirm all at once |
| **Realtime Dashboard** | Supabase Realtime subscription flashes live indicator on every DB change |
| **Search & Filter** | Filter by title, EPC, ISBN, category, location, status |
| **Android Bridge** | `window.onRFIDScan(epc)` is the contract between native and web |
| **Desktop Testing** | Manual EPC input fields on both add pages for dev without hardware |

---

## Database Schema

```sql
books_master
  id           UUID PK
  title        TEXT
  isbn         TEXT
  category     TEXT
  created_at   TIMESTAMPTZ

book_copies
  id           UUID PK
  book_id      UUID FK → books_master
  epc_tag      TEXT UNIQUE
  location     TEXT
  status       TEXT  (in_stock | checked_out | lost)
  date_added   TIMESTAMPTZ
  updated_at   TIMESTAMPTZ
```

---

## Android SDK Integration

Your UHF handheld ships with a manufacturer SDK (usually a `.aar` or `.jar`). The key integration point:

```java
// In your SDK scan callback:
rfidReader.setCallback(new ScanCallback() {
    @Override
    public void onTagScanned(String epc) {
        runOnUiThread(() -> injectEpc(epc));
    }
});

// This method bridges native → WebView:
public void injectEpc(String epc) {
    String safeEpc = epc.replace("'", "\\'").trim();
    webView.evaluateJavascript(
        "if(typeof window.onRFIDScan === 'function') { window.onRFIDScan('" + safeEpc + "'); }",
        null
    );
}
```

---

## Network Setup

Both the PC and Android handheld must be on the **same WiFi network**.

1. Find your PC IP: `ipconfig` → IPv4 under WiFi adapter
2. Set `WEB_APP_URL` in `MainActivity.java` to `http://192.168.X.X:3000`
3. Allow inbound port 3000 in Windows Firewall

---

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Lucide React
- **Backend**: Supabase (PostgreSQL + Realtime)
- **Mobile**: Android Java, WebView

---

*StockMind — a RoboKorda initiative · Making Robotics & Coding Fun*
