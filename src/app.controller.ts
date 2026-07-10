import { Controller, Get, Header, StreamableFile } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('preview/ppt')
  @Header('Content-Type', 'application/vnd.ms-powerpoint')
  // Use 'inline' to suggest the browser should display the file, or 'attachment' to force a download.
  @Header('Content-Disposition', 'inline; filename="presentation.ppt"')
  getPptPreview(): StreamableFile {
    // Note: For a .pptx file, the Content-Type should be:
    // 'application/vnd.openxmlformats-officedocument.presentationml.presentation' [2]
    return this.appService.getPptPreview();
  }
}
