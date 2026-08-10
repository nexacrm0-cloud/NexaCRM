import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/register',
  '/accept-invitation',
  '/forgot-password',
  '/reset-password',
  '/two-factor',
  '/pricing',
  '/automation/pro',
  '/automatizaciones/pro',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith('/api/'));
  if (isPublic) return NextResponse.next();

  const refreshCookie =
    request.cookies.get('__Host-refresh_token')?.value ||
    request.cookies.get('refresh_token')?.value;

  if (!refreshCookie) return NextResponse.next();

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.).*)'],
};
