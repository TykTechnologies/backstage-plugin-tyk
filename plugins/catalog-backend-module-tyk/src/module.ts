import { loggerToWinstonLogger } from '@backstage/backend-common';
import { coreServices, createBackendModule } from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node/alpha';
import { Router } from 'express';
import { TykEntityProvider } from './providers';

export const catalogModuleTykEntityProvider = createBackendModule({
  moduleId: 'catalog-backend-module-tyk-entity-provider',
  pluginId: 'catalog',
  register(env) {
    env.registerInit({
      deps: {
        catalog: catalogProcessingExtensionPoint,
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        scheduler: coreServices.scheduler,
        http: coreServices.httpRouter,
      },
      async init({ catalog, config, logger, http, scheduler }) {
        const router = Router();
        catalog.addEntityProvider(
          TykEntityProvider.fromConfig(config, loggerToWinstonLogger(logger), router, scheduler),
        );
        http.use(router);
      },
    });
  },
});
