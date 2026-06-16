import { Test, TestingModule } from '@nestjs/testing';
import { ZabbixController } from './zabbix.controller';

describe('ZabbixController', () => {
  let controller: ZabbixController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ZabbixController],
    }).compile();

    controller = module.get<ZabbixController>(ZabbixController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
