import {Config} from '@backstage/config';
import {Logger} from 'winston';
import {createTemplateAction} from '@backstage/plugin-scaffolder-node';
import {z} from 'zod';
import {TykDashboardConfig} from "../../../../../../plugins/catalog-backend-module-tyk/src/providers/types";
import {API} from "../../../../../../plugins/catalog-backend-module-tyk/src/clients/types";
import {TykDashboardClient} from "../../../../../../plugins/catalog-backend-module-tyk/src/clients/tyk-dashboard-client";

export const createTykApiAction = (config: Config, logger: Logger) => {
  return createTemplateAction({
    id: 'tyk:api:create',
    schema: {
      input: z.object ({
        name: z.string(),
        listenPath: z.string(),
        targetUrl: z.string(),
        targetDashboard: z.string(),
      }),
    },
    async handler(ctx) {
      logger.info('Running tyk:api:create template action');

      const dashboardConfigs: TykDashboardConfig[] = config.get("tyk.dashboards") as TykDashboardConfig[];
      const dashboardClients = dashboardConfigs.map((dashboardConfig: TykDashboardConfig) => {
        return new TykDashboardClient({log: logger, cfg: dashboardConfig});
      });

      const targetDashboard = dashboardClients.find((dashboard) => {
        return dashboard.name == ctx.input.targetDashboard;
      });
        
      if (!targetDashboard) {
        throw new Error(`Selected Target Tyk Dashboard "${ctx.input.targetDashboard}" could not be found in configuration - check that a dashboard configuration with a matching name exists in the tyk.dashboards section of the app-config.yaml`);
      }

      // scaffold a basic API combining required fields with the form input data
      const newApi: API = {
        api_definition: {
          name: ctx.input.name,
          api_id: "",
          use_keyless: true,
          version_data: {
            not_versioned: true,
            versions: {}
          },
          tags: [],
          proxy: {
            listen_path: `/${ctx.input.listenPath}/`,
            target_url: ctx.input.targetUrl,
            strip_listen_path: true
          },          
          active: true,
        }          
      };
      
      const createResult = await targetDashboard.createApi(newApi);

      if (createResult) {
        ctx.logger.info(`Successfully added API ${ctx.input.name} to Tyk`);
      } else {
        throw new Error(`Error adding API ${ctx.input.name} to Tyk`);
      }
    },
  });
};