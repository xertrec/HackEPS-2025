import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LifestyleModule } from './lifestyle/lifestyle.module';
import { ServicesModule } from './services/services.module';
import { DatabaseModule } from './database/database.module';
import { SecurityModule } from './security/security.module';
import { MobilityModule } from './mobility/mobility.module';
import { MobilityController } from './mobility/mobility.controller';

@Module({
	imports: [DatabaseModule, LifestyleModule, ServicesModule, MobilityModule, SecurityModule],
	controllers: [AppController, MobilityController],
	providers: [AppService],
})
export class AppModule {}
