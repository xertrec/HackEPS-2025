import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LifestyleModule } from './lifestyle/lifestyle.module';

@Module({
  imports: [LifestyleModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
