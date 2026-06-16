import { Test, TestingModule } from '@nestjs/testing';
import { ZabbixService } from './zabbix.service';

describe('ZabbixService', () => {
  let service: ZabbixService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ZabbixService],
    }).compile();

    service = module.get<ZabbixService>(ZabbixService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
