import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ServicesModule } from './services/services.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [DatabaseModule, ServicesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
