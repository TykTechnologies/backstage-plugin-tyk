import { CatalogBuilder } from '@backstage/plugin-catalog-backend';
import { createRouter } from '@internal/plugin-tyk-backend';
import { Router } from 'express';
import { PluginEnvironment } from '../types';
import { TykEntityProvider } from '../../../../plugins/backend-catalog-tyk-entitiy-provider/backend-catalog-tyk-entity-provider';
import { ScaffolderEntitiesProcessor } from '@backstage/plugin-scaffolder-backend';

export default async function createPlugin(
  env: PluginEnvironment,
): Promise<Router> {
  // Here is where you will add all of the required initialization code that
  // your backend plugin needs to be able to start!

  const builder = CatalogBuilder.create(env);
  const tykEntityProvider = new TykEntityProvider({
    logger: env.logger,
    env: 'test',
    config: env.config,
  });
  builder.addEntityProvider(tykEntityProvider);
  builder.addProcessor(new ScaffolderEntitiesProcessor());
  const { processingEngine } = await builder.build();
  await processingEngine.start();

  // The env contains a lot of goodies, but our router currently only
  // needs a logger
  return await createRouter({
    env: env,
    ep: tykEntityProvider
  });
}