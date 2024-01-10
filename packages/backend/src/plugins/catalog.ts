import { CatalogBuilder } from '@backstage/plugin-catalog-backend';
import { ScaffolderEntitiesProcessor } from '@backstage/plugin-scaffolder-backend';
import { Router } from 'express';
import { PluginEnvironment } from '../types';
import { TykEntityProvider } from '../../../../plugins/backend-catalog-tyk-entitiy-provider/backend-catalog-tyk-entity-provider';

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

  router.post("/tyk/sync", async (_req, res) => {
    await tykEntityProvider.importAllApis();
    res.status(200).end();
  });

  tykEntityProvider.init(router, env.scheduler);

  return router;
}
