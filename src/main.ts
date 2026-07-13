import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'https://srm-crm-frontend.onrender.com',
      process.env.FRONTEND_URL,
    ].filter(Boolean),
  });
  await app.listen(process.env.PORT ?? 3005);
}
bootstrap();
