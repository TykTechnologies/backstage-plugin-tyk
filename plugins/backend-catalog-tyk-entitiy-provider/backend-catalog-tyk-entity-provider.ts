import {
  ANNOTATION_LOCATION,
  ANNOTATION_ORIGIN_LOCATION,
  ApiEntityV1alpha1
} from '@backstage/catalog-model'
import {
  EntityProvider,
  EntityProviderConnection,
} from '@backstage/plugin-catalog-node';
import {Logger} from 'winston';
import {Config} from '@backstage/config';
import {kebabCase} from 'lodash';
import {z} from 'zod';
import yaml from 'js-yaml';

const APISchema = z.object({
  api_definition: z.object({
    api_id: z.string(),
    name: z.string(),
  }),
  oas: z.any().optional(),
});

const APIListResponseSchema = z.object({
  apis: z.array(APISchema),
});

type APIListResponse = z.infer<typeof APIListResponseSchema>;
type API = z.infer<typeof APISchema>;

export class TykEntityProvider implements EntityProvider {
  private readonly env: string;
  private readonly logger: Logger;
  private readonly dashboardApiHost: string;
  private readonly dashboardApiToken: string;
  private connection?: EntityProviderConnection;

  constructor(opts: { logger: Logger; env: string; config: Config; }) {
    const {logger, env, config} = opts;
    this.logger = logger;
    this.env = env;

    this.dashboardApiToken = config.getString('tyk.dashboardApi.token')
    console.log("foo")
    this.dashboardApiHost = config.getString('tyk.dashboardApi.host')
    console.log("bar")


    this.logger.info(`Tyk Dashboard Host: ${this.dashboardApiHost}`)
    this.logger.info(`Tyk Dashboard Token: ${this.dashboardApiToken.slice(0, 4)} (first 4 characters)`)
  }

  async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection
  }

  getProviderName(): string {
    return `tyk-entity-provider-${this.env}`
  }

  async getAllApis(): Promise<API[]> {
    const response = await fetch(`${this.dashboardApiHost}/api/apis`,
      {headers: {Authorization: `${this.dashboardApiToken}`}}
    );

    const data: APIListResponse = await response.json()

    APIListResponseSchema.parse(data)

    return data.apis;
  }

  convertApisToResources(apis: API[]): ApiEntityV1alpha1[] {
    const apiResources: ApiEntityV1alpha1[] = []

    for (const api of apis) {
      this.logger.info(`Processing ${api.api_definition.name}`)

      let definition: string = 'openapi: "3.0.0"';
      // console.log(definition);
      if (typeof api.oas == "object") {
        definition = yaml.dump(api.oas);
        console.log(definition);
      }

      apiResources.push({
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'API',
        metadata: {
          annotations: {
            [ANNOTATION_LOCATION]: 'tyk-api-http://localhost:3000/',
            [ANNOTATION_ORIGIN_LOCATION]: 'tyk-api-http://localhost:3000/',
            'tyk-id': api.api_definition.api_id,
          },
          name: kebabCase(api.api_definition.name),
          title: api.api_definition.name,
        },
        spec: {
          type: 'http',
          system: 'tyk',
          owner: 'guests',
          lifecycle: 'experimental',
          definition: definition,
        },
      })
    }

    return apiResources
  }

  async run(): Promise<void> {
    this.logger.info("Running Tyk Entity Provider")

    if (!this.connection) {
      throw new Error('Not initialized');
    }

    const apis = await this.getAllApis()
    const apiResources = this.convertApisToResources(apis)

    await this.connection.applyMutation({
      type: 'full',
      entities: apiResources.map((entity) => ({
        entity,
        locationKey: `${this.getProviderName()}`,
      })),
    })
  }
}
