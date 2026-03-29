import { Router } from 'express';
import { parseLeaderboardQuery, parseProfileIdParam } from '../http/validation';
import { getLeaderboard, getLeaderboardRank } from '../services/leaderboardService';

export const leaderboardRoutes = Router();

leaderboardRoutes.get('/leaderboard', async (request, response) => {
  const { limit, offset } = parseLeaderboardQuery(request.query as Record<string, unknown>);
  response.json(await getLeaderboard(limit, offset));
});

leaderboardRoutes.get('/leaderboard/:profileId/rank', async (request, response) => {
  const profileId = parseProfileIdParam(request.params.profileId);
  response.json(await getLeaderboardRank(profileId));
});
