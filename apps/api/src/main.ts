import { config } from 'dotenv';
config();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import express from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { Sentry, isSentryEnabled } from './common/sentry.config';

function validateEnv() {
  const isProd = process.env.NODE_ENV === 'production';
  const required = isProd
    ? [
        'JWT_SECRET',
        'JWT_REFRESH_SECRET',
        'DATABASE_URL',
        'INTERNAL_API_KEY',
        'WHATSAPP_APP_SECRET',
        'FRONTEND_URL',
      ]
    : ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL'];
  const missing = required.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(`FALTAN variables de entorno críticas: ${missing.join(', ')}`);
  }

  // Reject known-placeholder values that operators often forget to rotate.
  const knownPlaceholders = new Set([
    'your-super-secret-jwt-key-change-in-production',
    'your-super-secret-refresh-key-change-in-production',
    'change-this-in-production',
    'dev-jwt-secret-change-in-production',
    'dev-refresh-secret-change-in-production',
    'sk-your-openai-api-key',
    'nexa_whatsapp_verify_2026',
  ]);
  for (const key of [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'INTERNAL_API_KEY',
    'WHATSAPP_APP_SECRET',
    'WHATSAPP_VERIFY_TOKEN',
    'OPENAI_API_KEY',
  ]) {
    if (process.env[key] && knownPlaceholders.has(process.env[key] as string)) {
      throw new Error(
        `CRITICAL: ${key} todavía tiene un valor placeholder público. Generá uno seguro y único.`,
      );
    }
  }

  if ((process.env.JWT_SECRET?.length ?? 0) < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres');
  }
  if ((process.env.JWT_REFRESH_SECRET?.length ?? 0) < 32) {
    throw new Error('JWT_REFRESH_SECRET debe tener al menos 32 caracteres');
  }
  if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_SECRET y JWT_REFRESH_SECRET deben ser distintos');
  }
  if (isProd && process.env.FRONTEND_URL?.startsWith('http://localhost')) {
    throw new Error('FRONTEND_URL no debe ser localhost en producción');
  }
}

async function bootstrap() {
  validateEnv();
  const logger = new Logger('NexaAPI');
  if (isSentryEnabled()) {
    logger.log('Sentry inicializado (env SENTRY_DSN)');
  } else if (process.env.NODE_ENV === 'production') {
    logger.warn('SENTRY_DSN no configurado en produccion: errores no seran trackeados');
  }

  // Capturar crashes fatales inesperados (uncaught + unhandled)
  process.on('uncaughtException', (err) => {
    if (isSentryEnabled()) Sentry.captureException(err);
    logger.error(`uncaughtException: ${err.message}`, err.stack);
  });
  process.on('unhandledRejection', (reason) => {
    if (isSentryEnabled()) Sentry.captureException(reason);
    logger.error(
      `unhandledRejection: ${reason instanceof Error ? reason.message : String(reason)}`,
    );
  });

  const app = await NestFactory.create(AppModule);

  // Required for accurate client IP behind reverse proxies (used by
  // ThrottlerGuard) and to set secure=true on cookies when HTTPS arrives via
  // a TLS-terminating load balancer.
  const isProd = process.env.NODE_ENV === 'production';
  (app as any).set('trust proxy', isProd ? 1 : false);

  app.setGlobalPrefix('api/v1');
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  // Strict CSP. The API never serves HTML, so no inline styles/scripts are
  // legitimate — 'unsafe-inline' is kept only for local dev convenience to
  // render raw error payloads in the browser. In prod we drop it and pin a
  // hardened policy: base/form/frame/worker all locked to 'self' or 'none',
  // mixed content blocked, and COOP/COEP/CORP/Origin-Agent-Cluster layered on
  // top to make this origin non-openable/cross-origin-isolated.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: isProd ? ["'self'"] : ["'self'"],
          styleSrc: isProd ? ["'self'"] : ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", frontendUrl],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameSrc: ["'none'"],
          frameAncestors: ["'none'"],
          childSrc: ["'none'"],
          workerSrc: ["'none'"],
          manifestSrc: ["'self'"],
          mediaSrc: ["'none'"],
          prefetchSrc: ["'none'"],
          // Block anything not covered by an explicit directive above.
          navigateTo: ["'self'"],
          upgradeInsecureRequests: [],
          // Disallow Flash/PDF/Acrobat plugins from loading cross-origin.
          pluginTypes: ["'none'"],
        },
        // Drop the header entirely if a directive is unsupported rather than
        // emitting a lax default.
        reportOnly: false,
      },
      // HSTS pinned for 1y with preload; only sent over HTTPS by Helmet.
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'same-origin' },
      crossOriginEmbedderPolicy: { policy: 'require-corp' },
      originAgentCluster: true,
      // No XML/SWF/SSL policy files served from this origin.
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
      // Force every response to be downloaded with the declared Content-Type,
      // preventing browser MIME-sniffing from turning a .txt into HTML/JS.
      noSniff: true,
      // Block frames/tbh/iframes embedding this origin (defense-in-depth on
      // top of frame-ancestors, which some legacy browsers ignore).
      xFrameOptions: { action: 'deny' },
      // Keep DNS over HTTPS prefetch off by default; not used here.
      dnsPrefetchControl: { allow: false },
      // IE legacy: make sure XSS Auditor stays on for old clients.
      ieNoOpen: true,
    }),
  );
  // Capture raw body for HMAC verification on webhook endpoints.
  // NestJS' ValidationPipe parses the body, so we keep the raw bytes via rawBody.
  app.use(
    express.json({
      limit: '1mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = Buffer.from(buf);
      },
    }),
  );
  app.use(cookieParser());
  // Serve uploads with strict headers: never sniff MIME, force download, and
  // prevent this static route from being used as an XSS sink. The actual
  // tenancy check happens because uploads are referenced by URL we returned
  // after the authenticated POST (file names are 32-hex random). For
  // stronger isolation we still recommend moving to S3 with signed URLs.
  app.use(
    '/uploads',
    express.static('uploads', {
      index: false,
      redirect: false,
      dotfiles: 'ignore',
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
        res.setHeader('Cache-Control', 'private, max-age=0, no-cache');
        // Force download for documents so they cannot be opened inline in
        // the same origin (mitigates polyglot-PDF/HTML XSS).
        const url = (res.req && res.req.url) || '';
        if (url.startsWith('/uploads/documents/')) {
          res.setHeader('Content-Disposition', 'attachment');
        }
      },
    }),
  );

  const allowedOrigins = ['http://localhost:3000'];
  if (process.env.FRONTEND_URL && !allowedOrigins.includes(process.env.FRONTEND_URL)) {
    allowedOrigins.push(process.env.FRONTEND_URL);
  }
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: origin ${origin} not allowed`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  // The RlsCleanupInterceptor is registered via APP_INTERCEPTOR in
  // AppModule so its PrismaService dependency is injected by the DI
  // container (it can't be `new`-ed in main.ts because it needs Prisma).
  // The LoggingInterceptor is stateless and stays here for parity with
  // the legacy bootstrap.
  app.useGlobalInterceptors(new LoggingInterceptor());

  if (isSentryEnabled()) {
    Sentry.setupExpressErrorHandler(app as any);
  }

  const port = process.env.API_PORT || 4000;
  await app.listen(port);
  logger.log(`Nexa CRM API running on http://localhost:${port}/api/v1`);
}

bootstrap().catch((err) => {
  if (isSentryEnabled()) Sentry.captureException(err);
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
