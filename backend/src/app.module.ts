import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LifestyleModule } from './lifestyle/lifestyle.module';
import { ServicesModule } from './services/services.module';
import { DatabaseModule } from './database/database.module';

import { MobilityController } from './mobility/mobility.controller';
import { MobilityModule } from './mobility/mobility.module';
import { SecurityModule } from './security/security.module';

@Module({
  imports: [
    DatabaseModule,
    LifestyleModule,
    ServicesModule,
    MobilityModule,
    SecurityModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
