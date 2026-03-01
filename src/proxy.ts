import { NextRequest, NextResponse } from 'next/server';

const SECRET = process.env.LOGIN_SECRET ?? 'stockmind-secret-change-in-prod';
const COOKIE = 'sm_session';

async function verifyToken(token: string): Promise<boolean> {
  try {
    const [payloadB64, sigB64] = token.split('.');
    if (!payloadB64 || !sigB64) return false;

    // Re-add padding
    const pad = (s: string) => s + '='.repeat((4 - s.length % 4) % 4);
    const payload = atob(pad(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const sigBytes = Uint8Array.from(atob(pad(sigB64.replace(/-/g, '+').replace(/_/g, '/'))), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(payload));
    return valid;
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public paths — no auth needed
  const isPublic =
    pathname.startsWith('/scan') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname === '/manifest.json' ||
    pathname.startsWith('/robokorda') ||
    pathname === '/login';

  if (isPublic) return NextResponse.next();

  const token = req.cookies.get(COOKIE)?.value;
  if (token && await verifyToken(token)) return NextResponse.next();

  // Not authenticated — redirect to login
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/login';
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.svg|.*\\.ico|manifest.json).*)',
  ],
};
