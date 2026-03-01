export type BookStatus = 'in_stock' | 'checked_out' | 'lost' | 'sold';

export interface BookMaster {
  id: string;
  title: string;
  isbn: string | null;
  category: string | null;
  created_at: string;
}

export interface BookCopy {
  id: string;
  book_id: string;
  epc_tag: string;
  location: string | null;
  status: BookStatus;
  date_added: string;
  updated_at: string;
  books_master?: BookMaster;
}

export interface BookCopyWithMaster extends BookCopy {
  books_master: BookMaster;
}

export interface DashboardStats {
  total_copies: number;
  in_stock: number;
  checked_out: number;
  lost: number;
  total_titles: number;
  total_sales: number;
  total_revenue: number;
}

export interface Sale {
  id: string;
  copy_id: string | null;
  book_id: string | null;
  epc_tag: string;
  title: string;
  isbn: string | null;
  category: string | null;
  location: string | null;
  price_paid: number;
  sold_at: string;
  notes: string | null;
}

// Bridge type for Android → WebView RFID injection
declare global {
  interface Window {
    onRFIDScan: (epc: string) => void;
  }
}

