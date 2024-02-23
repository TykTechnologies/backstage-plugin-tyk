import {CatalogBuilder} from '@backstage/plugin-catalog-backend';
import {ScaffolderEntitiesProcessor} from '@backstage/plugin-scaffolder-backend';
import {Router} from 'express';
import {PluginEnvironment} from '../types';
import {
  TykEntityProvider
} from "../../../../plugins/catalog-backend-module-tyk/src/providers/tyk-entity-provider";

export default async function createPlugin(
  env: PluginEnvironment,
): Promise<Router> {
  const builder: CatalogBuilder = CatalogBuilder.create(env);
  builder.addProcessor(new ScaffolderEntitiesProcessor());

  const tykEPs = TykEntityProvider.fromConfig(env.config, env.logger);
  builder.addEntityProvider(tykEPs);

  const {processingEngine, router} = await builder.build();
  await processingEngine.start();

  await Promise.all(tykEPs.map(async (ep) => {
    await ep.init(router, env.scheduler);
  }));

  return router;
}
