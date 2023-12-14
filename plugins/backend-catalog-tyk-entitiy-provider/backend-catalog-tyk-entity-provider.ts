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
import {IdentityApi} from "@backstage/plugin-auth-node";

const APISchema = z.object({
  api_definition: z.object({
    api_id: z.string(),
    name: z.string(),
    graphql: z.object({
      enabled: z.boolean(),
      schema: z.string(),
    }).optional(),
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

  constructor(opts: { logger: Logger; env: string; config: Config; identity: IdentityApi}) {
    const {logger, env, config} = opts;
    this.logger = logger;
    this.env = env;

    this.dashboardApiToken = config.getString('tyk.dashboardApi.token')
    this.dashboardApiHost = config.getString('tyk.dashboardApi.host')

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
    // this is an example, that just fetches the first page of APIs
    const response = await fetch(`${this.dashboardApiHost}/api/apis`, 
      { headers: { Authorization: `${this.dashboardApiToken}` } }
    )
    
    const data: APIListResponse = await response.json()
    
    if (response.status != 200) {
      this.logger.error(`Error fetching API definitions from ${this.dashboardApiHost}: ${response.status} ${response.statusText}`)
    } else {
      if (data.apis == undefined) {
        this.logger.warn(`No API definitions found at ${this.dashboardApiHost}.`)
      } else {
        APIListResponseSchema.parse(data)
      }
    }
    
    return data.apis;
  }

  convertApisToResources(apis: API[]): ApiEntityV1alpha1[] {
    const apiResources: ApiEntityV1alpha1[] = []

    for (const api of apis) {
      this.logger.info(`Processing ${api.api_definition.name}`)

      let spec = {
        type: 'openapi',
        system: 'tyk',
        owner: 'guests',
        lifecycle: 'experimental',
        definition: 'openapi: "3.0.0"',
      }

      let linkPathPart = "designer";
      if (typeof api.oas == "object") {
        spec.definition = yaml.dump(api.oas);
        linkPathPart = "oas";
      } else if (api.api_definition.graphql?.enabled === true) {
        spec.definition = api.api_definition.graphql?.schema;
        spec.type = 'graphql';
      }

      // this is a simplistic API CRD, for purpose of demonstration
      apiResources.push({
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'API',
        metadata: {
          annotations: {
            [ANNOTATION_LOCATION]: 'tyk-api-http://localhost:3000/',
            [ANNOTATION_ORIGIN_LOCATION]: 'tyk-api-http://localhost:3000/',
            'tyk-id': api.api_definition.api_id,
          },
          links: [
            {
              url: `${this.dashboardApiHost}/apis/${linkPathPart}/${api.api_definition.api_id}`,
              title: "Design Tyk API",
              icon: "dashboard"
            },
            {
              url: `${this.dashboardApiHost}/activity-api/${api.api_definition.api_id}?api_name=${api.api_definition.name}`,
              title: "Tyk Analytics for API",
              icon: "chart-bar"
            },
          ],
          name: kebabCase(api.api_definition.name),
          title: api.api_definition.name,
        },
        spec: spec,
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
