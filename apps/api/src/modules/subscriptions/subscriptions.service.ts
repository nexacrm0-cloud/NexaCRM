import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@nexa/database';

const PLANS = {
  free: {
    id: 'free',
    name: 'Básico',
    price: 0,
    currency: 'USD',
    interval: 'month',
    features: [
      'CRM completo',
      'Pipeline de ventas',
      'Tareas y calendario',
      'Presupuestos y facturación',
      'Hasta 3 usuarios',
    ],
    limits: { users: 3, clients: 100, storage: 100 },
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 29,
    currency: 'USD',
    interval: 'month',
    features: [
      'Todo del plan Básico',
      'Automatizaciones (Automation Center)',
      'Agente de Seguimiento IA',
      'Hasta 10 usuarios',
      'Soporte por email',
    ],
    limits: { users: 10, clients: 1000, storage: 1000 },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 79,
    currency: 'USD',
    interval: 'month',
    features: [
      'Todo del plan Starter',
      'Agentes de Ventas IA',
      'Analista de Negocios IA',
      'Conectores premium',
      'Hasta 25 usuarios',
      'Soporte prioritario',
    ],
    limits: { users: 25, clients: 10000, storage: 5000 },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 199,
    currency: 'USD',
    interval: 'month',
    features: [
      'Todo del plan Pro',
      'Agentes de Operaciones IA',
      'API completa',
      'Usuarios ilimitados',
      'Soporte dedicado',
      'SLA 99.9%',
      'Onboarding personalizado',
    ],
    limits: { users: -1, clients: -1, storage: -1 },
  },
};

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(private prisma: PrismaService) {}

  async getAvailablePlans() {
    return Object.values(PLANS);
  }

  async getCurrentPlan(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, plan: true, name: true },
    });
    if (!org) throw new NotFoundException('Organización no encontrada');

    const subscription = await this.prisma.subscription.findUnique({
      where: { organizationId },
    });

    const planDetails = PLANS[org.plan as keyof typeof PLANS] ?? PLANS.free;

    return {
      organizationId: org.id,
      organizationName: org.name,
      currentPlan: planDetails,
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            canceledAt: subscription.canceledAt,
          }
        : null,
    };
  }

  async changePlan(organizationId: string, newPlan: string) {
    const planConfig = PLANS[newPlan as keyof typeof PLANS];
    if (!planConfig) throw new BadRequestException('Plan inválido');

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { plan: true },
    });
    if (!org) throw new NotFoundException('Organización no encontrada');

    if (org.plan === newPlan) {
      throw new BadRequestException('Ya estás en este plan');
    }

    // SECURITY INFO-21: this legacy endpoint is an unprotected stub — it
    // simply flips `organization.plan` with no payment. A real plan upgrade
    // (free -> any paid tier, or any paid -> a higher tier) MUST go through
    // /automation/my/subscriptions/start-checkout which integrates the
    // payment provider. Here we only allow DOWNgrades back to free, which
    // is effectively a self-serve cancel. Any other transition is rejected.
    if (newPlan !== 'free') {
      throw new BadRequestException(
        'Usá el flujo de pago (checkout) para cambiar a un plan pago. Este endpoint solo permite cancelar el plan actual.',
      );
    }

    await this.cancelPlan(organizationId);
    return { success: true, plan: PLANS.free };
  }

  async cancelPlan(organizationId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { organizationId },
    });
    if (!subscription) throw new NotFoundException('Suscripción no encontrada');

    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { organizationId },
        data: { status: 'canceled', canceledAt: new Date() },
      });

      await tx.organization.update({
        where: { id: organizationId },
        data: { plan: 'free' },
      });
    });

    return { success: true };
  }
}
