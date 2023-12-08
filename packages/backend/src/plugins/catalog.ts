import { CatalogBuilder } from '@backstage/plugin-catalog-backend';
import { ScaffolderEntitiesProcessor } from '@backstage/plugin-scaffolder-backend';
import { Router } from 'express';
import { PluginEnvironment } from '../types';
import { TykEntityProvider } from '../../../../plugins/backend-catalog-tyk-entitiy-provider/backend-catalog-tyk-entity-provider';

export default async function createPlugin(
  env: PluginEnvironment,
): Promise<Router> {
  const builder = await CatalogBuilder.create(env);
  const tykEntityProvider = new TykEntityProvider({
    logger: env.logger,
    env: 'test',
    config: env.config,
  });
  builder.addEntityProvider(tykEntityProvider);

  builder.addProcessor(new ScaffolderEntitiesProcessor());
  const { processingEngine, router } = await builder.build();
  await processingEngine.start();

  // for creating individual APIs based on posted data
/* example:
curl --location 'localhost:7007/api/catalog/tyk/api' \
--header 'Content-Type: application/json' \
--data '{
  "name": "Single Imported API",
  "id": "12345"
}'
*/
  router.post("/tyk/api", async (req, res) => {
    // to access body data, requests must use application/json Content-Type header
    tykEntityProvider.importApi({ 
      api_definition: {
        api_id: req.body.id,
        name: req.body.name
      }
    });
    res.status(200).end();
  })

  // for importing all APIs from the Tyk Dashboard
/* example:
curl --location 'localhost:7007/api/catalog/tyk/api/import-all'
*/
  router.get("/tyk/api/import-all", async (_req, res) => {
    await tykEntityProvider.importAllApis();
    res.status(200).end();
  })

  await env.scheduler.scheduleTask({
    id: 'run_tyk_entity_provider_refresh',
    fn: async () => {
      await tykEntityProvider.importAllApis();
    },
    frequency: { minutes: 2 },
    timeout: { minutes: 1 },
  });

  return router;
}
