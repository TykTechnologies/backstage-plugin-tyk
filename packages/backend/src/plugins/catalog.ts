import {CatalogBuilder} from '@backstage/plugin-catalog-backend';
import {ScaffolderEntitiesProcessor} from '@backstage/plugin-scaffolder-backend';
import {Router} from 'express';
import {PluginEnvironment} from '../types';
import {
  TykEntityProvider
} from '../../../../plugins/catalog-backend-module-tyk';

export default async function createPlugin(
  env: PluginEnvironment,
): Promise<Router> {
  const builder: CatalogBuilder = CatalogBuilder.create(env);
  builder.addProcessor(new ScaffolderEntitiesProcessor());

  const tykEPs = TykEntityProvider.fromConfig({ config:env.config, logger:env.logger });
  builder.addEntityProvider(tykEPs);  

  const {processingEngine, router} = await builder.build();
  await processingEngine.start();

  await Promise.all(tykEPs.map(async (ep) => {
    await ep.init();
    await ep.registerRoutes(router);
    await ep.registerSchedule(env.scheduler);
  }));

  return router;
}
