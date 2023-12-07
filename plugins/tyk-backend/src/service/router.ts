import { errorHandler } from '@backstage/backend-common';
import express from 'express';
import Router from 'express-promise-router';
import { PluginEnvironment } from '../../../../packages/backend/src/types';
import { TykEntityProvider } from '../../../../plugins/backend-catalog-tyk-entitiy-provider/backend-catalog-tyk-entity-provider';

export interface RouterOptions {
  env: PluginEnvironment,
  ep: TykEntityProvider
}

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { env, ep } = options;
  const logger = env.logger
  const tykEntityProvider = ep

  const router = Router();
  router.use(express.json());

  router.get('/health', (_, response) => {
    logger.info('PONG!');
    response.json({ status: 'ok' });
  });

/* 

Example request to trigger code below:

curl --location 'localhost:7007/api/tyk/api' \
--header 'Content-Type: application/json' \
--data '{
  "name": "TEST API",
  "id": "12345"
}'

*/
  router.post('/api', (req, res) => {
    logger.info('Importing API Definition');

    // to access body data, requests must use correct Content-Type header i.e. application/json
    logger.info('API name:' + req.body.name);
    logger.info('API id:' + req.body.id);
    
    tykEntityProvider.import({ 
      api_definition: {
        api_id: req.body.id,
        name: req.body.name
      }
    });
    
    res.json({ status: 'ok' });
  });

  router.use(errorHandler());
  return router;
}
