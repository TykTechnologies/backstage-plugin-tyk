import {CatalogBuilder} from '@backstage/plugin-catalog-backend';
import {ScaffolderEntitiesProcessor} from '@backstage/plugin-scaffolder-backend';
import {Router} from 'express';
import {PluginEnvironment} from '../types';
import {TykConfig, TykDashboardConfig} from "../../../../plugins/backend-catalog-tyk-entitiy-provider/schemas/schemas";
import {
  TykEntityProvider
} from "../../../../plugins/backend-catalog-tyk-entitiy-provider/backend-catalog-tyk-entity-provider";

export default async function createPlugin(
  env: PluginEnvironment,
): Promise<Router> {
  const builder: CatalogBuilder = CatalogBuilder.create(env);
  builder.addProcessor(new ScaffolderEntitiesProcessor());

  const tykConfig: TykConfig = env.config.get("tyk");
  const tykEPs: TykEntityProvider[] = [];
  tykConfig.dashboards.forEach((dashboard: TykDashboardConfig) => {
    const ep: TykEntityProvider = new TykEntityProvider({
      logger: env.logger,
      config: env.config.get('tyk'),
      dashboardName: dashboard.name,
    });

    tykEPs.push(ep);
    builder.addEntityProvider(ep);
  });

  const {processingEngine, router} = await builder.build();
  await processingEngine.start();

  await Promise.all(tykEPs.map(async (ep) => {
    await ep.init(router, env.scheduler);
  }));

  return router;
}
