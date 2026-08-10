import { BadRequestException } from '@nestjs/common';
import { URL } from 'url';
import dns from 'node:dns/promises';
import net from 'node:net';

// CIDR ranges that must NEVER be reachable from a webhook-style outbound
// HTTP request. The validator first rejects textual private hostnames, and
// then resolves the hostname via DNS to reject private IPs returned at
// runtime (closing DNS-rebinding attacks).
const PRIVATE_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./, // link-local incl. AWS/GCP metadata service
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT 100.64.0.0/10
  /^::1$/,
  /^::ffff:/, // IPv4-mapped IPv6
  /^fc00:/i, // ULA
  /^fd[0-9a-f]{2}:/i, // ULA
  /^fe80:/i, // link-local
  /^64:ff9b::/, // NAT64 to 127.0.0.1
  /^100::/, // discard prefix
];

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.aws.internal',
]);

function ipv4InPrivateRange(ip: string): boolean {
  if (!net.isIPv4(ip)) return false;
  for (const re of PRIVATE_RANGES) {
    if (re.test(ip)) return true;
  }
  return false;
}

function ipv6IsPrivate(ip: string): boolean {
  if (!net.isIPv6(ip)) return false;
  const lower = ip.toLowerCase();
  for (const re of PRIVATE_RANGES) {
    if (re.test(lower)) return true;
  }
  // ::ffff:a.b.c.d IPv4-mapped already covered; also reject unspecified.
  if (lower === '::') return true;
  return false;
}

function ipIsPrivate(ip: string): boolean {
  return ipv4InPrivateRange(ip) || ipv6IsPrivate(ip);
}

/**
 * Validates that a URL is safe to call from the server for webhook-style
 * outbound HTTP. Resolves the hostname to actual IPs via `dns.lookup(all)`
 * and rejects if ANY resolved IP is private/link-local/loopback. This closes
 * DNS-rebinding and hostname-shortcut (e.g. `0x7f000001`, `2130706433`)
 * bypasses against a text-only regex check.
 */
export async function validateWebhookUrlAsync(urlString: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new BadRequestException('URL de webhook inválida');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BadRequestException('Solo se permiten URLs HTTP/HTTPS');
  }

  if (url.username || url.password) {
    // userinfo can carry encoded characters that confuse downstream parsers.
    throw new BadRequestException('La URL no debe contener credenciales');
  }

  const hostname = url.hostname;

  if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) {
    throw new BadRequestException('Hostname no permitido');
  }

  // Always enforce IP-range checks, even in development. The previous
  // `NODE_ENV=development` short-circuit disabled ALL protection and let
  // staging/dev environment services be scanned for internal endpoints.
  // Resolve the hostname to actual IPs to defeat DNS rebinding and decimal/
  // hex IP encodings — they all resolve to real private addresses.
  let addresses: string[];
  try {
    const records = await dns.lookup(hostname, { all: true });
    addresses = records.map((r) => r.address);
  } catch {
    throw new BadRequestException('No se pudo resolver el hostname del webhook');
  }
  if (addresses.length === 0) {
    throw new BadRequestException('No se pudo resolver el hostname del webhook');
  }
  for (const ip of addresses) {
    if (ipIsPrivate(ip)) {
      throw new BadRequestException('No se permiten direcciones IP privadas o locales');
    }
  }

  return url;
}

/**
 * Synchronous variant kept for backwards compatibility with code paths
 * that cannot await. It performs the textual-only checks; for any new
 * outbound request prefer `validateWebhookUrlAsync`.
 */
export function validateWebhookUrl(urlString: string): URL {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new BadRequestException('URL de webhook inválida');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BadRequestException('Solo se permiten URLs HTTP/HTTPS');
  }
  if (url.username || url.password) {
    throw new BadRequestException('La URL no debe contener credenciales');
  }

  const hostname = url.hostname;

  if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) {
    throw new BadRequestException('Hostname no permitido');
  }

  // Direct IP literal?
  if (net.isIP(hostname)) {
    if (ipIsPrivate(hostname)) {
      throw new BadRequestException('No se permiten direcciones IP privadas o locales');
    }
    return url;
  }

  // Hostname text patterns (a hint; the async variant resolves DNS).
  if (PRIVATE_RANGES.some((re) => re.test(hostname))) {
    throw new BadRequestException('No se permiten direcciones IP privadas o locales');
  }
  // Decimal/hex/octal forms pointing at 127.0.0.1: e.g. 2130706433, 0x7f000001.
  if (/^\d+$/.test(hostname)) {
    const n = Number(hostname);
    if (Number.isFinite(n) && n >= 0 && n <= 0xffffffff) {
      const a = (n >>> 24) & 0xff;
      if (a === 127 || a === 0 || a === 10) {
        throw new BadRequestException('No se permiten direcciones IP privadas o locales');
      }
    }
  }

  return url;
}
