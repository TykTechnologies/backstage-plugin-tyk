import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
// import { TykEntityProvider } from '../../../../../../plugins/backend-catalog-tyk-entitiy-provider/backend-catalog-tyk-entity-provider';
import {z} from 'zod';

export const createTykApiAction = () => {
  return createTemplateAction({
    id: 'tyk:api:create',
    schema: {
      input: z.object ({
        name: z.string(),
        active: z.boolean(),
        targetUrl: z.string(),
      }),
    },
    async handler(ctx) {
        ctx.logger.info("Adding API to Tyk Dashboard")

    //   await fs.outputFile(
    //     `${ctx.workspacePath}/${ctx.input.filename}`,
    //     ctx.input.contents,
    //   );
    },
  });
};