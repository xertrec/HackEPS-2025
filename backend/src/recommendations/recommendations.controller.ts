import { Controller, Post, Body } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import type { UserProfile } from './recommendations.types';
import { RecommendationResponse } from './recommendations.types';

@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Post()
  async getRecommendations(@Body() profile: UserProfile): Promise<RecommendationResponse> {
    return this.recommendationsService.getNeighborhoodRecommendations(profile);
  }
}
