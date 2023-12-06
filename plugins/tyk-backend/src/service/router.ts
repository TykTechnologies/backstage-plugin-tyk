import { errorHandler } from '@backstage/backend-common';
import express from 'express';
import Router from 'express-promise-router';
import { Logger } from 'winston';

export interface RouterOptions {
  logger: Logger;
}

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { logger } = options;

  const router = Router();
  router.use(express.json());

  router.get('/health', (_, response) => {
    logger.info('PONG!');
    response.json({ status: 'ok' });
  });

  router.post('/api', (req, res) => {
    logger.info('Importing API Definition');
    // to access body, requests must use correct Content-Type header i.e. application/json
    logger.info('name:'+req.body.name);
    
    res.json({ status: 'ok' });
  });

  router.use(errorHandler());
  return router;
}
