import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { PrismaService } from '@nexa/database';
import { DEMO_ACCOUNTS, DemoAccount, demoExpiryFromNow, resetDemoTenant } from '@nexa/database';
import { DEMO_EXPIRED_MESSAGE, isDemoExpired } from '@nexa/shared';

export type DemoAccessRequest = {
  /** Email of the prospect: it becomes the OWNER login of their own tenant. */
  email: string;
  /** Company / prospect name, shown in the org and used in the URL slug. */
  name?: string;
  /** Contact name of the prospect (defaults to the email local part). */
  contactName?: string;
};

export type DemoAccessGrant = {
  /** One-click URL the prospect opens. */
  url: string;
  email: string;
  password: string;
  organizationId: string;
  slug: string;
  expiresAt: string;
};

/**
 * Grants a PROSPECT its own demo tenant and a one-click link.
 *
 * Every prospect gets a SEPARATE organization (a separate tenant), so the
 * Row Level Security policies isolate them completely: the prospect only ever
 * sees their own demo data, and whatever they create stays in their tenant.
 *
 * The link carries a signed token that the web exchanges for a normal
 * session (`GET /demo/session/:token`), so the prospect does not have to type
 * credentials. The token expires with the demo window.
 */
@Injectable()
export class DemoAccessService {
  private readonly logger = new Logger(DemoAccessService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /**
   * Creates (or re-opens) the demo tenant of a prospect and mints the
   * one-click link.
   */
  async createDemoAccess(request: DemoAccessRequest): Promise<DemoAccessGrant> {
    const email = request.email.trim().toLowerCase();
    const companyName = (request.name ?? 'Nexa Demo').trim();
    const contactName = (request.contactName ?? email.split('@')[0]).trim();

    // The prospect may already have a demo from a previous conversation: in
    // that case we REOPEN the same tenant (fresh window, fresh seed) instead
    // of creating a second one — the email is unique across the platform.
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, organizationId: true, organization: { select: { slug: true } } },
    });

    const slug = existingUser?.organization.slug ?? this.buildSlug(companyName);
    const demoExpiresAt = demoExpiryFromNow();

    // Support accounts for the tenant: unique emails (the shared demo
    // logins belong to the shared demo tenant only).
    const accounts: DemoAccount[] = [
      {
        id: `demo-${slug}-owner`,
        email,
        password: this.buildPassword(),
        firstName: this.firstName(contactName),
        lastName: this.lastName(contactName),
        role: 'OWNER',
      },
      ...DEMO_ACCOUNTS.filter((account) => account.role !== 'OWNER').map((account, index) => ({
        ...account,
        id: `demo-${slug}-${index + 1}`,
        email: `demo-${slug}-${index + 1}@nexacrm.com`,
      })),
    ];

    const result = await resetDemoTenant(this.prisma, {
      slug,
      name: companyName,
      plan: 'pro',
      isDemo: true,
      demoExpiresAt,
      accounts,
    });

    if (!result) {
      throw new UnauthorizedException(
        'Otro proceso está reseteando esta demo. Reintentá en un momento.',
      );
    }

    const owner = result.accounts.find((account) => account.email === email);
    if (!owner) {
      throw new UnauthorizedException('No se pudo crear la cuenta de la demo.');
    }

    const token = await this.jwtService.signAsync(
      {
        sub: owner.id,
        organizationId: result.organizationId,
        email,
        type: 'demo-access',
      },
      {
        secret: this.demoSecret(),
        expiresIn: Math.max(60, Math.floor((demoExpiresAt.getTime() - Date.now()) / 1000)),
      },
    );

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

    this.logger.log(`Demo creada para ${email} (${slug}) hasta ${demoExpiresAt.toISOString()}`);

    return {
      url: `${frontendUrl}/demo/${token}`,
      email,
      password: owner.password,
      organizationId: result.organizationId,
      slug: result.slug,
      expiresAt: demoExpiresAt.toISOString(),
    };
  }

  /**
   * Exchanges a demo link token for a regular session.
   *
   * The demo deadline is enforced HERE as well: a link whose tenant already
   * expired cannot be exchanged, even if the token itself is still valid.
   */
  async exchangeDemoToken(token: string) {
    let payload: { sub: string; organizationId: string; email: string; type?: string };
    try {
      payload = await this.jwtService.verifyAsync(token, { secret: this.demoSecret() });
    } catch {
      throw new UnauthorizedException('Link de demo inválido o vencido.');
    }

    if (payload.type !== 'demo-access') {
      throw new UnauthorizedException('Link de demo inválido o vencido.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        organization: { select: { name: true, plan: true, isDemo: true, demoExpiresAt: true } },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('La demo ya no está disponible.');
    }

    if (isDemoExpired(user.organization)) {
      throw new UnauthorizedException(DEMO_EXPIRED_MESSAGE);
    }

    const tokenId = randomBytes(16).toString('hex');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        {
          sub: user.id,
          email: user.email,
          organizationId: user.organizationId,
          role: user.role,
          tokenId,
        },
        // Same secret as the rest of the API: this token has to be accepted
        // by the JWT strategy / the access guard.
        { secret: process.env.JWT_SECRET },
      ),
      this.jwtService.signAsync(
        {
          sub: user.id,
          tokenId,
          email: user.email,
          organizationId: user.organizationId,
          role: user.role,
        },
        { secret: process.env.JWT_REFRESH_SECRET, expiresIn: '24h' },
      ),
    ]);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        phone: user.phone,
        role: user.role,
        organizationId: user.organizationId,
        organizationName: user.organization.name,
        organizationPlan: user.organization.plan,
        isDemo: user.organization.isDemo,
        demoExpiresAt: user.organization.demoExpiresAt,
      },
    };
  }

  private demoSecret(): string {
    return process.env.JWT_DEMO_ACCESS_SECRET || process.env.JWT_SECRET || 'nexa-demo-access';
  }

  private buildSlug(name: string): string {
    const base = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 24);
    const suffix = randomBytes(4).toString('hex');
    return `demo-${base || 'prospect'}-${suffix}`;
  }

  private buildPassword(): string {
    return randomBytes(9).toString('base64url');
  }

  private firstName(contactName: string): string {
    return contactName.split(/\s+/)[0] || 'Demo';
  }

  private lastName(contactName: string): string {
    const parts = contactName.split(/\s+/);
    return parts.length > 1 ? parts.slice(1).join(' ') : 'Nexa';
  }
}
