import {Config} from '@backstage/config';
import {Logger} from 'winston';
import {createTemplateAction} from '@backstage/plugin-scaffolder-node';
import {z} from 'zod';

export const createTykApiAction = (config: Config, logger: Logger) => {
  return createTemplateAction({
    id: 'tyk:api:create',
    schema: {
      input: z.object ({
        name: z.string(),
        listenPath: z.string(),
        targetUrl: z.string(),
      }),
    },
    async handler(ctx) {
      logger.info('Running tyk:api:create template action')
        
      const dashboardApiToken = config.getString('tyk.dashboardApi.token')
      const dashboardApiHost = config.getString('tyk.dashboardApi.host')

      try {
        const response = await fetch(dashboardApiHost + '/api/apis', {
          method: 'POST',
          headers: {
            Authorization: dashboardApiToken
          },
          body: JSON.stringify({
            api_definition: {
              name: ctx.input.name,
              use_keyless: true,
              version_data: {
                not_versioned: true,
                versions: {}
              },
              proxy: {
                listen_path: `/${ctx.input.listenPath}/`,
                target_url: ctx.input.targetUrl,
                strip_listen_path: true
              },
              active: true
            }
          })
        })
  
        const data = await response.json();
        if (response.status != 200) {
          logger.error(`Error adding API ${ctx.input.name} to Tyk:` + data);
          ctx.logger.error(`Error adding API ${ctx.input.name} to Tyk`);
        } else {
          logger.info(`Added API ${ctx.input.name} to Tyk`);
          ctx.logger.info(`Added API ${ctx.input.name} to Tyk`);
        }
      } catch (error) {
        logger.error(error);
        ctx.logger.error(`Error adding API ${ctx.input.name} to Tyk`);
      }
    },
  });
};