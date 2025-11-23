import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MobilityModule } from './mobility/mobility.module';
<<<<<<< HEAD
import { Neighborhood } from './mobility/neighborhood.entity';
=======
import { SecurityModule } from './security/security.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
>>>>>>> a84a3a26eff54cba94e6171efb3495fb1100b2bb

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'neighborhoods.db', // Asegúrate que este archivo está en la raíz
      entities: [Neighborhood],      // <--- IMPORTANTE
      synchronize: false,
    }),
    MobilityModule,
<<<<<<< HEAD
=======
    SecurityModule,
    RecommendationsModule,
>>>>>>> a84a3a26eff54cba94e6171efb3495fb1100b2bb
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}