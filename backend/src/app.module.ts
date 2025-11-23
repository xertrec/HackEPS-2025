import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MobilityModule } from './mobility/mobility.module';
import { Neighborhood } from './mobility/neighborhood.entity';
import { SecurityModule } from './security/security.module';
import { ServicesModule } from './services/services.module';
import { LifestyleModule } from './lifestyle/lifestyle.module';
import { RecommendationsModule } from './recommendations/recommendations.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'neighborhoods.db', // Asegúrate que este archivo está en la raíz
      entities: [Neighborhood],      // <--- IMPORTANTE
      synchronize: false,
    }),
    MobilityModule,
    SecurityModule,
    ServicesModule,
    LifestyleModule,
    RecommendationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}