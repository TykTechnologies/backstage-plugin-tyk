import { coreServices, createBackendModule } from '@backstage/backend-plugin-api';

export const catalogModuleTyk = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'tyk',
  register(reg) {
    reg.registerInit({
      deps: { logger: coreServices.logger },
      async init({ logger }) {
        logger.info('Hello World!')
      },
    });
  },
});
