import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import crypto from 'crypto';
import { PrismaService } from '@nexa/database';
import { EventBusService } from '../../event-bus/event-bus.service';
import { NotificationsService } from '../notifications/notifications.service';
import { v4 as uuid } from 'uuid';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '@nexa/shared';

// SECURITY ALTA-7: hierarchy used to bound which role an inviter can grant.
// Higher numbers = more privileged. SUPER_ADMIN is intentionally absent: it
// is never assignable through invitations.
const ROLE_LEVEL: Partial<Record<UserRole, number>> = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
    private notificationsService: NotificationsService,
  ) {}

  async create(
    data: { email: string; role: string },
    organizationId: string,
    invitedById: string,
    invitedByRole: UserRole,
  ) {
    // Reject SUPER_ADMIN and any unknown role outright (the schema already
    // enforces this, but we re-check defensively).
    const targetRole = data.role as UserRole;
    const targetLevel = ROLE_LEVEL[targetRole];
    const memberLevel = ROLE_LEVEL[UserRole.MEMBER];
    if (targetLevel === undefined || memberLevel === undefined) {
      throw new ForbiddenException('No tenés permisos para invitar con ese rol');
    }
    // An ADMIN cannot invite OWNER/ADMIN (can only invite <= MEMBER). An
    // OWNER can invite anyone in the tenant-role list.
    if (targetLevel > memberLevel && invitedByRole !== UserRole.OWNER) {
      throw new ForbiddenException('Solo un OWNER puede invitar ADMIN u OWNER');
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { email: data.email, organizationId },
    });
    if (existingUser) {
      throw new ConflictException('El usuario ya pertenece a esta organización');
    }

    const pending = await this.prisma.invitation.findFirst({
      where: { email: data.email, organizationId, status: 'PENDING' },
    });
    if (pending) {
      throw new ConflictException('Ya existe una invitación pendiente para este email');
    }

    const token = uuid();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await this.prisma.invitation.create({
      data: {
        email: data.email,
        role: data.role as any,
        token,
        expiresAt,
        organizationId,
        invitedById,
      },
    });

    const invitedBy = await this.prisma.user.findUnique({
      where: { id: invitedById },
      select: { firstName: true, lastName: true },
    });

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });

    const invitedByName = invitedBy
      ? `${invitedBy.firstName} ${invitedBy.lastName}`
      : 'Un administrador';

    await this.notificationsService.sendInvitationEmail(
      data.email,
      token,
      org!.name,
      invitedByName,
    );

    this.logger.log(`Invitation created for ${data.email} in org ${organizationId}`);

    this.eventBus.emit({
      eventName: 'invitation.created',
      aggregateType: 'invitation',
      aggregateId: invitation.id,
      payload: {
        invitationId: invitation.id,
        email: data.email,
        role: data.role,
      },
      metadata: {
        organizationId,
        userId: invitedById,
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
      },
    });

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
    };
  }

  async findAll(organizationId: string) {
    return this.prisma.invitation.findMany({
      where: { organizationId, status: 'PENDING' },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        invitedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(id: string, organizationId: string) {
    await this.prisma.$transaction(async (tx) => {
      const invitation = await tx.invitation.findFirst({
        where: { id, organizationId },
      });
      if (!invitation) {
        throw new NotFoundException('Invitación no encontrada');
      }
      await tx.invitation.update({
        where: { id },
        data: { status: 'REVOKED' },
      });
    });
  }

  async accept(token: string, data: { firstName: string; lastName: string; password: string }) {
    const invitation = await this.prisma.invitation.findUnique({ where: { token } });
    if (!invitation) {
      throw new BadRequestException('Token de invitación inválido');
    }
    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('La invitación ya fue utilizada o revocada');
    }
    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('La invitación ha expirado');
    }

    const existing = await this.prisma.user.findUnique({ where: { email: invitation.email } });
    if (existing) {
      throw new ConflictException('El email ya está registrado');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: invitation.email,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          role: invitation.role,
          organizationId: invitation.organizationId,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          organizationId: true,
          organization: { select: { name: true } },
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });

      return newUser;
    });

    this.logger.log(
      `Invitation accepted: ${invitation.email} joined org ${invitation.organizationId}`,
    );

    this.eventBus.emit({
      eventName: 'user.created',
      aggregateType: 'user',
      aggregateId: user.id,
      payload: {
        userId: user.id,
        email: user.email,
        firstName: data.firstName,
        lastName: data.lastName,
        role: invitation.role,
      },
      metadata: {
        organizationId: invitation.organizationId,
        userId: user.id,
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
      },
    });

    this.eventBus.emit({
      eventName: 'invitation.accepted',
      aggregateType: 'invitation',
      aggregateId: invitation.id,
      payload: {
        invitationId: invitation.id,
        email: invitation.email,
        userId: user.id,
      },
      metadata: {
        organizationId: invitation.organizationId,
        userId: user.id,
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
      },
    });

    return user;
  }
}
