import { Module } from '@nestjs/common';
import { GlpiController } from './glpi.controller';
import { GlpiService } from './glpi.service';

@Module({
  controllers: [GlpiController],
  providers: [GlpiService],
  exports: [GlpiService],
})
export class GlpiModule {}
