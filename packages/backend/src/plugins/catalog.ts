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

  // for importing individual APIs
  router.post("/tyk/import/api", async (req, _res) => {
/* to access body data, requests must use application/json Content-Type header, for example:

curl --location 'localhost:7007/api/catalog/tyk/import/api' \
--header 'Content-Type: application/json' \
--data '{
  "name": "Test API",
  "id": "12345"
}

*/
    tykEntityProvider.import({ 
      api_definition: {
        api_id: req.body.id,
        name: req.body.name
      }
    });
  })

  await env.scheduler.scheduleTask({
    id: 'run_tyk_entity_provider_refresh',
    fn: async () => {
      await tykEntityProvider.run();
    },
    frequency: { minutes: 2 },
    timeout: { minutes: 1 },
  });

  return router;
}
