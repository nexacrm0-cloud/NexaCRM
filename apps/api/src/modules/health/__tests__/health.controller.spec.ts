import { Test } from '@nestjs/testing';
import { HealthController } from '../health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = moduleRef.get(HealthController);
  });

  it('returns ok with uptime and timestamp (no DB dependency)', () => {
    const result = controller.liveness();
    expect(result.status).toBe('ok');
    expect(typeof result.uptime).toBe('number');
    expect(new Date(result.timestamp).getTime()).not.toBeNaN();
  });
});
