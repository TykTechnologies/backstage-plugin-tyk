import {Config} from '@backstage/config';
import {createTemplateAction} from '@backstage/plugin-scaffolder-node';
import {z} from 'zod';

export const createTykApiAction = (config: Config) => {
  return createTemplateAction({
    id: 'tyk:api:create',
    schema: {
      input: z.object ({
        name: z.string(),
        active: z.boolean(),
        listenPath: z.string(),
        targetUrl: z.string(),
      }),
    },
    async handler(ctx) {
        ctx.logger.info("Adding API to Tyk Dashboard")

        const dashboardApiToken = config.getString('tyk.dashboardApi.token')
        const dashboardApiHost = config.getString('tyk.dashboardApi.host')

        try {
          const response = await fetch(dashboardApiHost + "/api/apis", {
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
                active: ctx.input.active
              }
            })
          })
    
          const data = await response.json();
          if (response.status != 200) {
            ctx.logger.error('Error adding API to Tyk:' + data);
          } else {
            ctx.logger.info('API added to Tyk');
          }
        } catch (error) {
          ctx.logger.error(error)
        }
    //   await fs.outputFile(
    //     `${ctx.workspacePath}/${ctx.input.filename}`,
    //     ctx.input.contents,
    //   );
    },
  });
};