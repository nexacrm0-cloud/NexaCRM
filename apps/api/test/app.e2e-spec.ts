import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '@nexa/database';

describe('Nexa API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health', () => {
    it('POST /api/v1/auth/login should return 401 for invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'nonexistent@test.com', password: 'wrong' })
        .expect(401);
    });
  });

  describe('Auth Flow', () => {
    let accessToken: string;
    let refreshToken: string;

    it('POST /api/v1/auth/register should create user and organization', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'e2e-test@nexacrm.com',
          password: 'TestPass123',
          firstName: 'E2E',
          lastName: 'Test',
          organizationName: 'E2E Test Org',
        })
        .expect(201)
        .expect((res: any) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.accessToken).toBeDefined();
          expect(res.body.data.refreshToken).toBeDefined();
          accessToken = res.body.data.accessToken;
          refreshToken = res.body.data.refreshToken;
        });
    });

    it('POST /api/v1/auth/me should return user profile', () => {
      return request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res: any) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.email).toBe('e2e-test@nexacrm.com');
        });
    });

    it('POST /api/v1/auth/refresh should rotate tokens', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(201)
        .expect((res: any) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.accessToken).toBeDefined();
          expect(res.body.data.refreshToken).toBeDefined();
        });
    });
  });
});
