import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

// Public liveness probe for the load balancer / Render health check. It does
// NOT touch the database so a brief DB blip doesn't make Render kill and
// restart a perfectly healthy process (that would amplify an outage into a
// restart loop). Readiness against the DB is exercised naturally by real
// traffic; if you want a strict readiness gate, flip healthCheckPath to
// /api/v1/health/ready after confirming the DB is reachable.
@Controller('health')
@SkipThrottle()
export class HealthController {
  @Get()
  liveness() {
    return { status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() };
  }
}
