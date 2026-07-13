import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventsModule } from './events/events.module';
import { PrismaModule } from './prisma/prisma.module';
import { TemplateBlobUrlModule } from './template-blob-url/template-blob-url.module';
import { InstitutesModule } from './institutes/institutes.module';
import { DepartmentsModule } from './departments/departments.module';
import { UserAuthModule } from './user-auth/user-auth.module';

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    TemplateBlobUrlModule,
    InstitutesModule,
    DepartmentsModule,
    UserAuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

