import { NextRequest, NextResponse } from 'next/server';

const ADMIN_USER = process.env.ADMIN_USERNAME ?? 'admin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD ?? 'admin';
const SECRET     = process.env.LOGIN_SECRET    ?? 'stockmind-secret-change-in-prod';
const COOKIE     = 'sm_session';

// Simple HMAC-less token: base64(user:timestamp) signed by appending a hash
// We use a signed string: base64url(payload).base64url(hmac)
// For Edge runtime compatibility we use the Web Crypto API
async function sign(payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${btoa(payload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}.${sigB64}`;
}

export async function POST(req: NextRequest) {
  const { username, password } = await req.json().catch(() => ({}));

  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
  }

  const payload = JSON.stringify({ user: username, at: Date.now() });
  const token   = await sign(payload);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return res;
}
