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
import yaml from 'js-yaml';
import {API, APIListResponse, APIListResponseSchema, TykDashboardConfig} from "./schemas/schemas";

export class TykEntityProvider implements EntityProvider {
  private readonly env: string;
  private readonly logger: Logger;
  private readonly config: Config;
  private connection?: EntityProviderConnection;
  private dashboardConfigs: TykDashboardConfig[];

  constructor(opts: { logger: Logger; env: string; config: Config }) {
    const {logger, env, config} = opts;
    this.logger = logger;
    this.env = env;
    this.config = config;

    this.dashboardConfigs = this.config.get("tyk.dashboards") as TykDashboardConfig[]

    for (const key in this.dashboardConfigs) {
      const dashboardConfig = this.dashboardConfigs[key];
      this.logger.info(`Loaded "${key}" Tyk Dashboard config with host ${dashboardConfig.host} and token starting ${dashboardConfig.token.slice(0, 4)}`);
    }

    if (this.dashboardConfigs.length == 0) {
      this.logger.error("No Tyk Dashboard configuration found");
    }
  }

  async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection;
  }

  getProviderName(): string {
    return `tyk-entity-provider-${this.env}`;
  }

  async getAllApis(dashboardConfig: TykDashboardConfig): Promise<API[]> {
    // fetches all APIs using p=-1 query param
    const response = await fetch(`${dashboardConfig.host}/api/apis?p=-1`,
      { headers: { Authorization: `${dashboardConfig.token}` } }
    )
    let jsResponse = await response.json();

    const data: APIListResponse = jsResponse;

    if (response.status != 200) {
      switch (response.status) {
        case 401:
          this.logger.error(`Authorisation failed with Tyk Dashboard ${dashboardConfig.host} - check that 'token' is correctly configured in 'tyk.dashboard' app config settings`);
          break;
        default:
          this.logger.error(`Error fetching API definitions from ${dashboardConfig.host}: ${response.status} ${response.statusText}`);
          break;
      }
    } else {
      if (data.apis == undefined) {
        this.logger.warn(`No API definitions found at ${dashboardConfig.host}.`);
      } else {
        APIListResponseSchema.parse(data);
      }
    }

    return data.apis;
  }

  convertApisToResources(apis: API[], namespace: string, dashboardHost: string, defaultSystem?: string, defaultOwner?: string, defaultLifecycle?: string): ApiEntityV1alpha1[] {
    const apiResources: ApiEntityV1alpha1[] = [];

    for (const api of apis) {
      this.logger.info(`Generating API resource for ${api.api_definition.name}`);

      // if there is no defaultOwner and the api definition config_data does not provide an owner,
      // then we need to throw an error in the logs and skip this particular API definition

      const owner: string = api.api_definition.config_data?.backstage?.owner ?? (defaultOwner || "");
      if (owner === "") {
        this.logger.error(`No owner found for API ${api.api_definition.name} and no default owner configured, skipping`);
        break;
      }
      const lifecycle: string = api.api_definition.config_data?.backstage?.lifecycle ?? (defaultLifecycle || "");
      if (lifecycle === "") {
        this.logger.error(`No lifecycle found for API ${api.api_definition.name} and no default lifecycle configured, skipping`);
        break;
      }

      // resource name is composed of a namespace and an api id, the namespace is taken from the Tyk dashboard configuration
      // this is to avoid collisions between identical APIs in different Tyk dashboards
      const resourceName: string = `${kebabCase(namespace)}-${api.api_definition.api_id}`;
      let linkPathPart: string = "designer";
      const apiEditUrl: string = `${dashboardHost}/apis/${linkPathPart}/${api.api_definition.api_id}`;

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

      // this is a simplistic API CRD, for purpose of demonstration
      // note:
      //   - the Tyk API definition id value is mapped to the Backstage name field, because the name must be a unique value
      //   - the Tyk API definition name is mapped to the Backstage title field, to display the API name in the Backstage UI
      let apiResource: ApiEntityV1alpha1 = {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'API',
        metadata: {
          annotations: {
            [ANNOTATION_LOCATION]: `url:${dashboardHost}`,
            [ANNOTATION_ORIGIN_LOCATION]: `url:${dashboardHost}`,
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
              url: `${dashboardHost}/activity-api/${api.api_definition.api_id}?api_name=${api.api_definition.name}`,
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
          name: resourceName,
          title: api.api_definition.name,
        },
        spec: {
          type: 'openapi',
          system: api.api_definition.config_data?.backstage?.system ?? defaultSystem,
          owner: api.api_definition.config_data?.backstage?.owner ?? (defaultOwner || ""),
          lifecycle: api.api_definition.config_data?.backstage?.lifecycle ?? (defaultLifecycle || ""),
          definition: 'openapi: "3.0.0"',
        },
      };

      if (typeof api.oas == "object") {
        apiResource.spec.definition = yaml.dump(api.oas);
        linkPathPart = "oas";
      } else if (api.api_definition.graphql?.enabled === true) {
        apiResource.spec.definition = api.api_definition.graphql?.schema;
        apiResource.spec.type = 'graphql';
      }

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
    if (!this.connection) {
      throw new Error('Not initialized');
    }

    let allApiResources:ApiEntityV1alpha1[] = [];

    for (const key in this.dashboardConfigs) {
      const dashboardConfig = this.dashboardConfigs[key];

      this.logger.info(`Importing APIs from Tyk Dashboard host ${dashboardConfig.host}`);

      const apis: API[] = await this.getAllApis(dashboardConfig);

      if (apis == null || apis.length == 0) {
        this.logger.warn(`No APIs found at ${dashboardConfig.host}`);
        continue;
      }

      const hostApiResources = this.convertApisToResources(apis, key, dashboardConfig.host, dashboardConfig.defaults?.system, dashboardConfig.defaults?.owner, dashboardConfig.defaults?.lifecycle);

      this.logger.info(`Generated ${hostApiResources.length} API resources from host ${dashboardConfig.host}`);

      allApiResources = allApiResources.concat(hostApiResources);
    }

    this.logger.info(`Applying ${allApiResources.length} resources to catalog`);

    await this.connection.applyMutation({
      type: 'full',
      entities: allApiResources.map((entity) => ({
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
