import { Module } from '@nestjs/common';
import { TemplateBlobUrlService } from './template-blob-url.service';
import { TemplateBlobUrlController } from './template-blob-url.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TemplateBlobUrlController],
  providers: [TemplateBlobUrlService],
})
export class TemplateBlobUrlModule {}
