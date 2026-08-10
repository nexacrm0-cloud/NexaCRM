import { Module, Logger } from '@nestjs/common';
import { StubPaymentProvider } from './stub-payment.provider';
import { MercadoPagoProvider } from './mercadopago-payment.provider';
import { StripePaymentProvider } from './stripe-payment.provider';
import { SubscriptionsService } from './subscriptions.service';
import {
  SubscriptionsController,
  SubscriptionsWebhookController,
  StripeWebhookController,
  MercadoPagoWebhookController,
  SubscriptionsAdminController,
} from './subscriptions.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import type { PaymentProvider } from './payment-provider.interface';

@Module({
  imports: [NotificationsModule],
  providers: [
    StubPaymentProvider,
    MercadoPagoProvider,
    StripePaymentProvider,
    SubscriptionsService,
    {
      provide: 'PAYMENT_PROVIDER',
      useFactory: (
        stub: StubPaymentProvider,
        mp: MercadoPagoProvider,
        stripe: StripePaymentProvider,
      ): PaymentProvider => {
        const logger = new Logger('BillingModule');
        const kind = (process.env.PAYMENT_PROVIDER_KIND || 'stub').toLowerCase();

        if (kind === 'stripe') {
          logger.log('Usando StripePaymentProvider');
          return stripe;
        }

        if (kind === 'mercadopago') {
          logger.log('Usando MercadoPagoProvider');
          return mp;
        }

        if (kind !== 'stub') {
          throw new Error(
            `PAYMENT_PROVIDER_KIND="${kind}" no soportado. Valores validos: "stub" | "stripe" | "mercadopago".`,
          );
        }

        if (
          process.env.NODE_ENV === 'production' &&
          process.env.ALLOW_STUB_PAYMENT_IN_PROD !== '1'
        ) {
          logger.error(
            'REFUSANDO arrancar con StubPaymentProvider en produccion. ' +
              'Setea ALLOW_STUB_PAYMENT_IN_PROD=1 solo para alpha/piloto, o PAYMENT_PROVIDER_KIND=stripe|mercadopago.',
          );
          throw new Error(
            'StubPaymentProvider no puede usarse en produccion sin ALLOW_STUB_PAYMENT_IN_PROD=1.',
          );
        }
        if (process.env.NODE_ENV === 'production') {
          logger.warn(
            '⚠️  Arrancando con StubPaymentProvider en produccion (ALLOW_STUB_PAYMENT_IN_PROD=1). ' +
              'Los pagos NO se cobraran de verdad. Solo para alpha/piloto.',
          );
        }
        return stub;
      },
      inject: [StubPaymentProvider, MercadoPagoProvider, StripePaymentProvider],
    },
  ],
  controllers: [
    SubscriptionsController,
    SubscriptionsWebhookController,
    StripeWebhookController,
    MercadoPagoWebhookController,
    SubscriptionsAdminController,
  ],
  exports: ['PAYMENT_PROVIDER', SubscriptionsService],
})
export class BillingModule {}
