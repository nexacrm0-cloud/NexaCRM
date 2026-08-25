/**
 * SECURITY TESTS — Vector 7 (SSRF)
 *
 * Validates that `validateWebhookUrlAsync` and `validateWebhookUrl`
 * block all known dangerous targets: localhost, RFC1918 ranges, link-local,
 * metadata service IPs, IPv6 ULA, and decimal/hex obfuscation of 127.0.0.1.
 *
 * Any regression here would allow a server-side request forgery attack from
 * the workflow executor or agent webhook callback paths.
 */
import dns from 'node:dns/promises';
import { validateWebhookUrl, validateWebhookUrlAsync } from '../ssrf-validator';

jest.doMock('node:dns/promises', () => {
  const original = jest.requireActual('node:dns/promises');
  return {
    ...original,
    lookup: jest.fn(),
  };
});

describe('ssrf-validator', () => {
  // Reset mock state between tests
  beforeEach(() => {
    (dns.lookup as jest.Mock).mockReset();
  });

  describe('validateWebhookUrl (sync, textual)', () => {
    it.each([
      // RFC1918 IPv4 ranges
      'http://10.0.0.1/x',
      'http://10.255.255.255/x',
      'http://172.16.0.1/x',
      'http://172.31.255.255/x',
      'http://192.168.0.1/x',
      // Loopback
      'http://127.0.0.1/x',
      'http://127.255.255.255/x',
      // Link-local incl. cloud metadata
      'http://169.254.169.254/latest/meta-data/',
      'http://169.254.0.1/x',
      // CGNAT
      'http://100.64.0.1/x',
      // Wildcard
      'http://0.0.0.0/x',
      // Localhost alias
      'http://localhost/x',
      // Decimal / hex / octal forms of 127.0.0.1
      'http://2130706433/x',
      'http://0x7f000001/x',
      // Hostnames that bypass DNS
      'http://metadata.google.internal/x',
      'http://metadata.aws.internal/x',
    ])('rejects %s', (url) => {
      expect(() => validateWebhookUrl(url)).toThrow();
    });

    it.each([
      'http://example.com/x',
      'https://hooks.slack.com/services/AAA/BBB/CCC',
      'http://api.example.com/webhook',
      'http://8.8.8.8/x', // public IP literal
      'http://1.1.1.1/x',
    ])('accepts %s', (url) => {
      expect(() => validateWebhookUrl(url)).not.toThrow();
    });

    it('rejects URLs with userinfo (bypass attempts)', () => {
      expect(() => validateWebhookUrl('http://user:pass@example.com/')).toThrow();
    });

    it('rejects non-HTTP schemes', () => {
      expect(() => validateWebhookUrl('file:///etc/passwd')).toThrow();
      expect(() => validateWebhookUrl('gopher://attacker.com/')).toThrow();
      expect(() => validateWebhookUrl('javascript:alert(1)')).toThrow();
    });

    it('rejects malformed URLs', () => {
      expect(() => validateWebhookUrl('not a url')).toThrow();
      expect(() => validateWebhookUrl('')).toThrow();
    });
  });

  describe('validateWebhookUrlAsync (DNS resolution)', () => {
    it('rejects when DNS resolves to private IP (DNS rebinding defense)', async () => {
      (dns.lookup as jest.Mock).mockResolvedValueOnce('127.0.0.1');
      await expect(validateWebhookUrlAsync('http://localhost/x')).rejects.toThrow();
    });

    it('accepts a public domain that resolves', async () => {
      (dns.lookup as jest.Mock).mockResolvedValueOnce('8.8.8.8');
      const url = await validateWebhookUrlAsync('http://example.com/');
      expect(url.protocol).toMatch(/^https?:$/);
    });

    it('rejects when DNS lookup fails', async () => {
      (dns.lookup as jest.Mock).mockRejectedValueOnce(new Error('ENOTFOUND'));
      await expect(validateWebhookUrlAsync('http://any-host.invalid/x')).rejects.toThrow();
    });

    it.each([
      'http://[::1]/x',
      'http://[fe80::1]/x',
      'http://[fc00::1]/x',
    ])('rejects IPv6 literal %s', async (url) => {
      // IPv6 literals are handled by ipIsPrivate() in the async path.
      await expect(validateWebhookUrlAsync(url)).rejects.toThrow();
    });

    it('rejects when DNS returns a private IP (rebinding protection)', async () => {
      (dns.lookup as jest.Mock).mockResolvedValueOnce('10.0.0.1');
      await expect(validateWebhookUrlAsync('http://attacker.example/x')).rejects.toThrow(
        /privadas o locales/,
      );
    });
  });
});