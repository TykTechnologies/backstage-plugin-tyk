import { errorHandler } from '@backstage/backend-common';
import express from 'express';
import Router from 'express-promise-router';
import { PluginEnvironment } from '../../../../packages/backend/src/types';

export interface RouterOptions {
  env: PluginEnvironment
}

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { env } = options;
  const logger = env.logger

  const router = Router();
  router.use(express.json());

  router.get('/health', (_, response) => {
    logger.info('PONG!');
    response.json({ status: 'ok' });
  });

  router.use(errorHandler());
  return router;
}
