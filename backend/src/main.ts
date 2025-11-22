import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);


  app.enableCors();

  // Set global API prefix before starting the server so routes are registered under /api
  app.setGlobalPrefix('api');
  await app.listen(3000);
  console.log('Server listening on http://localhost:3000/api');

}
bootstrap();
