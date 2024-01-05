import { CatalogBuilder } from '@backstage/plugin-catalog-backend';
import { ScaffolderEntitiesProcessor } from '@backstage/plugin-scaffolder-backend';
import { Router } from 'express';
import { PluginEnvironment } from '../types';
import { TykEntityProvider } from '../../../../plugins/backend-catalog-tyk-entitiy-provider/backend-catalog-tyk-entity-provider';
import { ApiEvent } from '../../../../plugins/backend-catalog-tyk-entitiy-provider/backend-catalog-tyk-entity-provider';

export default async function createPlugin(
  env: PluginEnvironment,
): Promise<Router> {
  const builder = CatalogBuilder.create(env);
  const tykEntityProvider = new TykEntityProvider({
    logger: env.logger,
    env: 'test',
    config: env.config,
  });
  builder.addEntityProvider(tykEntityProvider);

  builder.addProcessor(new ScaffolderEntitiesProcessor());
  const { processingEngine, router } = await builder.build();
  await processingEngine.start();

  // imports single APIs based on a Tyk webhook API event
  // designed to work without a 'Content-Type' header, as the Tyk webhook doesn't contain one
/* example:
curl --location 'localhost:7007/api/catalog/tyk/api/hook' \
--data '{
  "event":"api_event.add",
  "data": {
    "api_definition": {
      "name": "Webhook API",
      "api_id": "12345"
    }
  }
}'
*/
  router.post("/tyk/api/hook", async(req, res) => {
    var data='';
    req.setEncoding('utf8');

    req.on('data', function(chunk) { 
      // manually build data from chunks
      data += chunk
    });
    req.on('end', function() {
      // parse data into object
      let apiEvent = JSON.parse(data) as ApiEvent
      
      switch (apiEvent.event) {
        case "api_event.add":
        case "api_event.update":
        case "api_event.delete":
            tykEntityProvider.importApi(
            apiEvent.data
          );
          res.status(200).end();
          break;
        default:
          env.logger.warn(`Webhook received with unknown api event: ${apiEvent.event}`)
          res.status(400).json({error: "unknown api event type"}).end();
          break;
      }
    });
  });

  // for creating individual APIs based on posted data
/* example:
curl --location 'localhost:7007/api/catalog/tyk/api' \
--header 'Content-Type: application/json' \
--data '{
  "name": "Single Imported API",
  "api_id": "12345"
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
  });

  // for importing all APIs from the Tyk Dashboard
/* example:
curl --location 'localhost:7007/api/catalog/tyk/api/import-all'
*/
  router.get("/tyk/api/import-all", async (_req, res) => {
    await tykEntityProvider.importAllApis();
    res.status(200).end();
  })

  // this is to enable webhook posts to trigger a full sync
  router.post("/tyk/api/import-all", async (_req, res) => {
    await tykEntityProvider.importAllApis();
    res.status(200).end();
  })

  await env.scheduler.scheduleTask({
    id: 'run_tyk_entity_provider_refresh',
    fn: async () => {
      await tykEntityProvider.importAllApis();
    },
    frequency: { minutes: 1 },
    timeout: { minutes: 1 },
  });

  return router;
}
