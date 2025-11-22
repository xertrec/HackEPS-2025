import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LifestyleModule } from './lifestyle/lifestyle.module';
import { ServicesModule } from './services/services.module';
import { MobilityModule } from './mobility/mobility.module';
@Module({
  imports: [LifestyleModule, ServicesModule, MobilityModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
