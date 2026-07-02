import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { EmailService } from './email.service';

class SendReportDto {
  pdfBase64: string;
  filename: string;
  monthLabel: string;
}

@Controller('report')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send-email')
  @HttpCode(HttpStatus.OK)
  async sendReport(@Body() body: SendReportDto) {
    await this.emailService.sendReportEmail(body.pdfBase64, body.filename, body.monthLabel);
    return { success: true, message: 'Report sent successfully.' };
  }
}
