import { Router } from 'express';
import { mockAreas } from '../../../src/data/mockAreas';
import { MarketAreaApiDocument } from '../types';

export const marketAreaRoutes = Router();

marketAreaRoutes.get('/market-areas', (_request, response) => {
  const payload: MarketAreaApiDocument[] = mockAreas.map((area) => ({
    id: area.id,
    label: area.label,
    subtitle: area.subtitle,
    center: area.center,
  }));

  response.json(payload);
});
