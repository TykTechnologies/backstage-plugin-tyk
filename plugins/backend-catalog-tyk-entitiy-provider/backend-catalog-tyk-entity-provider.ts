import {
  ANNOTATION_EDIT_URL,
  ANNOTATION_LOCATION,
  ANNOTATION_ORIGIN_LOCATION,
  ANNOTATION_SOURCE_LOCATION,
  ANNOTATION_VIEW_URL,
  ApiEntityV1alpha1
} from '@backstage/catalog-model'
import {EntityProvider, EntityProviderConnection,} from '@backstage/plugin-catalog-node';
import {Logger} from 'winston';
import {Config} from '@backstage/config';
import { Router } from 'express';
import { PluginTaskScheduler } from '@backstage/backend-tasks';
import {kebabCase} from 'lodash';
import yaml from 'js-yaml';
import {API, TykDashboardConfig, TykConfig} from "./schemas/schemas";
import {DashboardClient} from "./schemas/client/client";
export class TykEntityProvider implements EntityProvider {
  private readonly env: string;
  private readonly logger: Logger;
  private connection?: EntityProviderConnection;
  private dashboardClients: DashboardClient[];
  private readonly tykConfig: TykConfig;
  private readonly defaultSchedulerFrequency = 5

  constructor(props: { logger: Logger; env: string; config: Config }) {
    this.logger = props.logger;
    this.env = props.env;
    this.tykConfig = props.config.get("tyk")
    this.dashboardClients = this.tykConfig.dashboards.map((dashboardConfig: TykDashboardConfig) => {
      return new DashboardClient({log: props.logger, cfg: dashboardConfig});
    })
  }

  async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection;
  }

  async init(router: Router, scheduler: PluginTaskScheduler): Promise<void> {
    if (!this.tykConfig.router.enabled && !this.tykConfig.scheduler.enabled) {
      this.logger.warn("Tyk entity provider has no methods enabled for data collection - no data will be imported");
      return;
    }

    if (this.tykConfig.router.enabled) {
      this.logger.info("Registering Tyk routes");
      // for importing all APIs from the Tyk Dashboard, for both GET and POST
      // the POST request is to support webhook calls from Tyk Dashboard
      // these routes are accessible via the catalog api path /api/catalog/tyk/sync
      router.get("/tyk/sync", async (_req, res) => {
        await this.importAllApis();
        res.status(200).end();
      });
      router.post("/tyk/sync", async (_req, res) => {
        await this.importAllApis();
        res.status(200).end();
      });

      // sync on init is useful as it enables the system to populate data prior to any routes being called
      // if the scheduler is enabled, then this is not necessary as the scheduler will pull the data on startup
      if (this.tykConfig.router.syncOnInit) {
        this.importAllApis();
      }
    }

    if (this.tykConfig.scheduler.enabled) {
      this.logger.info("Scheduling Tyk task");
      
      let frequency = this.tykConfig.scheduler.frequency;
      if (frequency === undefined) {
        this.logger.info(`Tyk scheduler frequency not configured, using default value of ${this.defaultSchedulerFrequency}`);
        frequency = this.defaultSchedulerFrequency;
      }
      
      await scheduler.scheduleTask({
        id: 'run_tyk_entity_provider_refresh',
        fn: async () => {
          await this.importAllApis();
        },
        frequency: { minutes: frequency },
        timeout: { minutes: 1 },
      });        
    }
  }

  getProviderName(): string {
    return `tyk-entity-provider-${this.env}`;
  }

  convertApiToResource(api: API, config: TykDashboardConfig): ApiEntityV1alpha1 {
    this.logger.info(`Generating API resource for ${api.api_definition.name}`);

    // if there is no defaultOwner and the api definition config_data does not provide an owner,
    // then we need to throw an error in the logs and skip this particular API definition
    const owner: string = api.api_definition.config_data?.backstage?.owner ?? (config.defaults?.owner || "");
    if (owner === "") {
      this.logger.error(`No owner found for API ${api.api_definition.name} and no default owner configured, skipping`);
      throw new Error(`No owner found for API ${api.api_definition.name} and no default owner configured, skipping`);
    }
    const lifecycle: string = api.api_definition.config_data?.backstage?.lifecycle ?? (config.defaults?.lifecycle || "");
    if (lifecycle === "") {
      this.logger.error(`No lifecycle found for API ${api.api_definition.name} and no default lifecycle configured, skipping`);
      throw new Error(`No lifecycle found for API ${api.api_definition.name} and no default lifecycle configured, skipping`);
    }

    let resourceTitle = api.api_definition.name;
    let resourceTags: string[] = [];
    const tykCategoryPrefix = '#';
    if (api.api_definition.name.includes(tykCategoryPrefix)) {
      api.api_definition.name.split(tykCategoryPrefix).forEach((value, index) => {
        switch (index) {
          case 0:
            resourceTitle = value.trim();
            break;
          default:
            resourceTags.push(value.trim());
            break;
        }
      });
    }

    // resource name is composed of a namespace and an api id, the namespace is taken from the Tyk dashboard configuration
    // this is to avoid collisions between identical APIs in different Tyk dashboards
    const resourceName: string = `${kebabCase(config.name)}-${api.api_definition.api_id}`;
    let linkPathPart: string = "designer";
    const apiEditUrl: string = `${config.host}/apis/${linkPathPart}/${api.api_definition.api_id}`;

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
          [ANNOTATION_LOCATION]: `url:${config.host}`,
          [ANNOTATION_ORIGIN_LOCATION]: `url:${config.host}`,
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
            url: `${config.host}/activity-api/${api.api_definition.api_id}?api_name=${api.api_definition.name}`,
            title: "Tyk Analytics for API",
            icon: "chart-bar"
          },
        ],
        labels: {
          'tyk.io/active': api.api_definition.active.toString(),
          'tyk.io/apiId': api.api_definition.api_id,
          'tyk.io/name': kebabCase(resourceTitle),
          'tyk.io/authentication': authMechamism(api),
        },
        name: resourceName,
        title: resourceTitle,
      },
      spec: {
        type: 'openapi',
        system: api.api_definition.config_data?.backstage?.system ?? config.defaults?.system,
        owner: api.api_definition.config_data?.backstage?.owner ?? (config.defaults?.owner || ""),
        lifecycle: api.api_definition.config_data?.backstage?.lifecycle ?? (config.defaults?.lifecycle || ""),
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
        apiResource.metadata.labels!["tyk.io/" + label.key] = label.value;
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

    return apiResource;
  }

  async importAllApis(): Promise<void> {
    if (!this.connection) {
      throw new Error('Not initialized');
    }
    let allAPIs = this.dashboardClients.map((client: DashboardClient) => client.getApiList());
    let promiseResults = await Promise.allSettled(allAPIs);

    let allAPIResources: ApiEntityV1alpha1[] = promiseResults.map((promiseResult: PromiseSettledResult<API[]>, index: number) => {
      if (promiseResult.status === "fulfilled") {

        return promiseResult.value.map((api: API) => {
          return this.convertApiToResource(api, this.dashboardClients[index].getConfig());
        });
      }
      return [];
    }).flat();
    this.logger.info(`Applying ${allAPIResources.length} resources to catalog`);

    await this.connection.applyMutation({
      type: 'full',
      entities: allAPIResources.map((entity) => ({
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
    // TODO: we are always taking the first dashboard config in order to just make it kind of work, but this is a bug -
    //    we should be be able to determine which dashboard config to use, perhaps by including it in the importApi
    //    function signature
    const apiResource: ApiEntityV1alpha1 = this.convertApiToResource(api, this.dashboardClients[0].getConfig());
    let apiResources: ApiEntityV1alpha1[] = [apiResource];
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
