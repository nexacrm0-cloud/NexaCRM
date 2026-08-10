import { Module, Logger } from '@nestjs/common';
import { StubAfipProvider } from './stub-afip.provider';
import { AfipsdkProvider } from './afipsdk.provider';
import type { AfipProvider } from './afip-provider.interface';

@Module({
  providers: [
    StubAfipProvider,
    AfipsdkProvider,
    {
      provide: 'AFIP_PROVIDER',
      useFactory: (stub: StubAfipProvider, sdk: AfipsdkProvider): AfipProvider => {
        const logger = new Logger('AfipModule');
        const kind = (process.env.AFIP_PROVIDER_KIND || 'stub').toLowerCase();

        if (kind === 'afipsdk') {
          logger.log('Usando AfipsdkProvider (WSFE real)');
          return sdk;
        }

        if (kind !== 'stub') {
          throw new Error(
            `AFIP_PROVIDER_KIND="${kind}" no soportado. Valores validos: "stub" | "afipsdk".`,
          );
        }

        if (process.env.NODE_ENV === 'production' && process.env.ALLOW_STUB_AFIP_IN_PROD !== '1') {
          logger.warn(
            'AFIP_PROVIDER_KIND=stub en produccion. Las facturas se emitiran con CAE ficticio (sin validez fiscal). ' +
              'Setea AFIP_PROVIDER_KIND=afipsdk con certificados reales, o ALLOW_STUB_AFIP_IN_PROD=1 para alpha.',
          );
        }
        return stub;
      },
      inject: [StubAfipProvider, AfipsdkProvider],
    },
  ],
  exports: ['AFIP_PROVIDER'],
})
export class AfipModule {}
