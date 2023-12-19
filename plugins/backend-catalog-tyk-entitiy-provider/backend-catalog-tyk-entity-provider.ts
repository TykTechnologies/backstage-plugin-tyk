import {
  ANNOTATION_LOCATION,
  ANNOTATION_ORIGIN_LOCATION,
  ANNOTATION_EDIT_URL,
  ANNOTATION_VIEW_URL,
  ANNOTATION_SOURCE_LOCATION,
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
    active: z.boolean(),
    config_data: z.object({
      backstage: z.object({
        owner: z.string().optional(),
        lifecycle: z.string().optional(),
        system: z.string().optional(),
        labels: z.array(
          z.object({
            key: z.string(),
            value: z.string(),
          })
        ).optional()
      }).optional(),
    }).optional(),
    use_keyless: z.boolean().optional(),
    use_oauth2: z.boolean().optional(),
    use_standard_auth: z.boolean().optional(),
    use_mutual_tls_auth: z.boolean().optional(),
    use_basic_auth: z.boolean().optional(),
    use_jwt: z.boolean().optional(),
    graphql: z.object({
      enabled: z.boolean(),
      schema: z.string(),
    }).optional(),
  }),
  oas: z.any().optional(),
  user_group_owners: z.array(z.string()).optional(),
  user_owners: z.array(z.string()).optional(),
});

const ApiEventSchema = z.object({
  event: z.string(),
  data: APISchema
});

const APIListResponseSchema = z.object({
  apis: z.array(APISchema),
});

type APIListResponse = z.infer<typeof APIListResponseSchema>;
export type API = z.infer<typeof APISchema>;
export type ApiEvent = z.infer<typeof ApiEventSchema>;

export class TykEntityProvider implements EntityProvider {
  private readonly env: string;
  private readonly logger: Logger;
  private readonly config: Config;
  private readonly dashboardApiHost: string;
  private readonly dashboardApiToken: string;
  private connection?: EntityProviderConnection;

  constructor(opts: { logger: Logger; env: string; config: Config }) {
    const {logger, env, config} = opts;
    this.logger = logger;
    this.env = env;
    this.config = config;

    this.dashboardApiToken = config.getString('tyk.dashboardApi.token');
    this.dashboardApiHost = config.getString('tyk.dashboardApi.host');

    this.logger.info(`Tyk Dashboard Host: ${this.dashboardApiHost}`);
    this.logger.info(`Tyk Dashboard Token: ${this.dashboardApiToken.slice(0, 4)} (first 4 characters)`);
  }

  async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection;
  }

  getProviderName(): string {
    return `tyk-entity-provider-${this.env}`;
  }

  async getAllApis(): Promise<API[]> {
    // fetches all APIs using p=-1 query param
    const response = await fetch(`${this.dashboardApiHost}/api/apis?p=-1`, 
      { headers: { Authorization: `${this.dashboardApiToken}` } }
    )
    let jsResponse = await response.json();

    const data: APIListResponse = jsResponse;
    
    if (response.status != 200) {
      switch (response.status) {
        case 401:
          this.logger.error(`Authorisation failed with Tyk Dashboard ${this.dashboardApiHost} - check that 'tyk.dashboardApi.token' app config setting is correct`);
          break;
        default:
          this.logger.error(`Error fetching API definitions from ${this.dashboardApiHost}: ${response.status} ${response.statusText}`);
          break;
      }
    } else {
      if (data.apis == undefined) {
        this.logger.warn(`No API definitions found at ${this.dashboardApiHost}.`);
      } else {
        APIListResponseSchema.parse(data);
      }
    }
    
    return data.apis;
  }

  convertApisToResources(apis: API[]): ApiEntityV1alpha1[] {
    const apiResources: ApiEntityV1alpha1[] = [];

    for (const api of apis) {
      this.logger.info(`Processing ${api.api_definition.name}`);

      let spec = {
        type: 'openapi',
        system: api.api_definition.config_data?.backstage?.system ?? this.config.getString('tyk.import.defaults.system'),
        owner: api.api_definition.config_data?.backstage?.owner ?? this.config.getString('tyk.import.defaults.owner'),
        lifecycle: api.api_definition.config_data?.backstage?.lifecycle ?? this.config.getString('tyk.import.defaults.lifecycle'),
        definition: 'openapi: "3.0.0"',
      };

      let linkPathPart = "designer";
      if (typeof api.oas == "object") {
        spec.definition = yaml.dump(api.oas);
        linkPathPart = "oas";
      } else if (api.api_definition.graphql?.enabled === true) {
        spec.definition = api.api_definition.graphql?.schema;
        spec.type = 'graphql';
      }
      
      let authMechamism = (api: API): string => {
        if (api.api_definition.use_keyless === true) {
          return 'keyless';
        }

        if (api.api_definition.use_jwt === true) {
          return 'jwt';
        }

        if (api.api_definition.use_oauth2 === true) {
          return 'oauth2';
        }

        if (api.api_definition.use_basic_auth === true) {
          return 'basic';
        }

        if (api.api_definition.use_standard_auth === true) {
          return 'auth-token';
        }
        return 'unknown';
      }

      const apiEditUrl = `${this.dashboardApiHost}/apis/${linkPathPart}/${api.api_definition.api_id}`;

      // this is a simplistic API CRD, for purpose of demonstration
      // note: 
      //   - the Tyk API definition id value is mapped to the Backstage name field, because the name must be a unique value
      //   - the Tyk API definition name is mapped to the Backstage title field, to display the API name in the Backstage UI
      let apiResource: ApiEntityV1alpha1 = {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'API',
        metadata: {
          annotations: {
            [ANNOTATION_LOCATION]: `url:${this.dashboardApiHost}`,
            [ANNOTATION_ORIGIN_LOCATION]: `url:${this.dashboardApiHost}`,
            [ANNOTATION_EDIT_URL]: `${apiEditUrl}`,
            [ANNOTATION_VIEW_URL]: `${apiEditUrl}`,
            [ANNOTATION_SOURCE_LOCATION]: `${apiEditUrl}`,
          },
          links: [
            {
              url: apiEditUrl,
              title: "Design Tyk API",
              icon: "dashboard"
            },
            {
              url: `${this.dashboardApiHost}/activity-api/${api.api_definition.api_id}?api_name=${api.api_definition.name}`,
              title: "Tyk Analytics for API",
              icon: "chart-bar"
            },
          ],
          labels: {
            'tyk.io/active': api.api_definition.active.toString(),
            'tyk.io/apiId': api.api_definition.api_id,
            'tyk.io/name': kebabCase(api.api_definition.name),
            'tyk.io/authentication': authMechamism(api),
          },
          name: api.api_definition.api_id,
          title: api.api_definition.name,
        },
        spec: spec,
      };

      // add custom labels, if any exist
      if (api.api_definition.config_data?.backstage?.labels) {
        for (const label of api.api_definition.config_data?.backstage?.labels!) {
          // use to 'tyk.io/' prefix to distinguish that the labels are from Tyk
          // this seems like best practice, as we are using the standard 'API' entity kind, so anything we add to it should be distinguished
          apiResource.metadata.labels!["tyk.io/"+label.key] = label.value;
        }
      }

      // add ownership data as labels, if it exists
      // a few issues here:
      //   1 - the data is stored as guids in the apidef, so would need to perform lookup to get name of user/group
      //   2 - backstage labels are limited to 64 characters, so there is potential to exceed that amount, and if that happens then the entity will fail validation and won't be imported
      //   3 - backstage labels have a limited character set, so we have to use a dot as separator
      if (api.user_owners && api.user_owners.length > 0) {
        apiResource.metadata.labels!["tyk.io/user-owners"] = api.user_owners.join('.');
      }      
      if (api.user_group_owners && api.user_group_owners.length > 0) {
        apiResource.metadata.labels!["tyk.io/user-group-owners"] = api.user_group_owners.join('.');
      }


      apiResources.push(apiResource);
    }

    return apiResources;
  }

  async importAllApis(): Promise<void> {
    this.logger.info("Importing all APIs from Tyk Dashboard");

    if (!this.connection) {
      throw new Error('Not initialized');
    }

    const apis: API[] = await this.getAllApis();

    if (apis == null || apis.length == 0) {
      this.logger.warn("No APIs to process, aborting import");
      return;
    }
    const apiResources:ApiEntityV1alpha1[] = this.convertApisToResources(apis);

    await this.connection.applyMutation({
      type: 'full',
      entities: apiResources.map((entity) => ({
        entity,
        locationKey: `${this.getProviderName()}`,
      })),
    });
  }

  // NOTE: the mutation in this function uses a 'delta' approach, so will be overwritten by mutations that use the 'full' approach
  async importApi(api: API): Promise<void> {
    this.logger.info('Importing single API');

    if (!this.connection) {
      throw new Error('Not initialized');
    }

    // reuse existing functionality, which was designed to accept an array of APIs
    const apiResources = this.convertApisToResources([ api ]);

    await this.connection.applyMutation({
      type: 'delta',
      added: apiResources.map((entity) => ({
        entity,
        locationKey: `${this.getProviderName()}`,
      })),
      removed: []
    });
  }
}
