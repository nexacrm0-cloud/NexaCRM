import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CommandCenterService } from './command-center.service';

@Controller('commands')
export class CommandCenterController {
  constructor(private readonly commandCenter: CommandCenterService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async execute(@Body('command') command: string, @Req() req: any) {
    const context = {
      userId: req.user.id,
      organizationId: req.user.organizationId,
      role: req.user.role,
      permissions: [],
    };
    return this.commandCenter.execute(command, context);
  }
}
