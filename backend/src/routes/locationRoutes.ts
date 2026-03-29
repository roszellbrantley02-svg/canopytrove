import { Router } from 'express';
import { parseLocationQuery } from '../http/validation';
import { resolveLocationQuery } from '../locationService';

export const locationRoutes = Router();

locationRoutes.get('/resolve-location', async (request, response) => {
  const query = parseLocationQuery(request.query as Record<string, unknown>);
  const payload = await resolveLocationQuery(query);
  response.json(payload);
});
