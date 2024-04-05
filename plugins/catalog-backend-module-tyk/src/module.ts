import { loggerToWinstonLogger } from '@backstage/backend-common';
import { coreServices, createBackendModule } from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node/alpha';
import { Router } from 'express';
import { TykEntityProvider } from './providers';

export const catalogModuleTykEntityProvider = createBackendModule({
  moduleId: 'tyk-entity-provider',
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
          TykEntityProvider.fromConfig({ config: config, logger: loggerToWinstonLogger(logger), router: router, scheduler: scheduler }),
        );
        // enable unauthenticated calls to tyk endpoints
        // webhook requests from Tyk Dashboard will not contain any credentials
        // path equates to /api/catalog/tyk/*
        http.addAuthPolicy({
          path: "/tyk",
          allow: "unauthenticated"
        });
        http.use(router);
      },
    });
  },
});
