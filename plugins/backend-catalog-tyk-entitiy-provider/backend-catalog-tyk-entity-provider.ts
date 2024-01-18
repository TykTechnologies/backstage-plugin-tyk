import {
  ANNOTATION_EDIT_URL,
  ANNOTATION_LOCATION,
  ANNOTATION_ORIGIN_LOCATION,
  ANNOTATION_SOURCE_LOCATION,
  ANNOTATION_VIEW_URL,
  ApiEntityV1alpha1, ComponentEntityV1alpha1,
} from '@backstage/catalog-model'
import {DeferredEntity, EntityProvider, EntityProviderConnection,} from '@backstage/plugin-catalog-node';
import {Logger} from 'winston';
import {Router} from 'express';
import {PluginTaskScheduler} from '@backstage/backend-tasks';
import {kebabCase} from 'lodash';
import yaml from 'js-yaml';
import {API, TykDashboardConfig, TykConfig, enrichedGateway} from "./schemas/schemas";
import {DashboardClient} from "./schemas/client/client";

export class TykEntityProvider implements EntityProvider {
  private readonly logger: Logger;
  private connection?: EntityProviderConnection;
  private dashboardClient: DashboardClient;
  private dashboardConfig?: TykDashboardConfig;
  private readonly tykConfig: TykConfig;
  private readonly dashboardName: string;
  private readonly defaultSchedulerFrequency = 5

  constructor(props: { logger: Logger; config: TykConfig, dashboardName: string }) {
    this.logger = props.logger;
    this.tykConfig = props.config;
    this.dashboardName = props.dashboardName;

    this.dashboardConfig = this.tykConfig.dashboards.find((dashboard: TykDashboardConfig): boolean => dashboard.name == props.dashboardName)!;
    this.dashboardClient = new DashboardClient({
      log: props.logger,
      cfg: this.dashboardConfig,
    });
  }

  async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection;
  }

  getProviderName(): string {
    return `tyk-entity-provider-${this.dashboardName}`;
  }

  async init(router: Router, scheduler: PluginTaskScheduler): Promise<void> {
    this.logger.info(`Initializing Tyk entity provider for ${this.dashboardName} environment`);

    if (!this.connection) {
      throw new Error('Not initialized');
    }

    if (!this.tykConfig.router.enabled && !this.tykConfig.scheduler.enabled) {
      this.logger.warn("Tyk entity provider has no methods enabled for data collection - no data will be imported");
      return;
    }

    if (this.tykConfig.router.enabled) {
      this.logger.info("Registering Tyk routes");
      // for importing all APIs from the Tyk Dashboard, for both GET and POST
      // the POST request is to support webhook calls from Tyk Dashboard
      // these routes are accessible via the catalog api path /api/catalog/tyk/sync
      router.get(`/tyk/${this.dashboardName}/sync`, async (_req, res) => {
        await this.importAllDiscoveredEntities();
        res.status(200).end();
      });
      router.post(`/tyk/${this.dashboardName}/sync`, async (_req, res) => {
        await this.importAllDiscoveredEntities();
        res.status(200).end();
      });
    }

    if (this.tykConfig.scheduler.enabled) {
      this.logger.info("Scheduling Tyk task");

      let frequency: number = this.tykConfig.scheduler.frequency || this.defaultSchedulerFrequency;

      await scheduler.scheduleTask({
        id: 'run_tyk_entity_provider_refresh',
        fn: async () => {
          await this.importAllDiscoveredEntities();
        },
        frequency: {minutes: frequency},
        timeout: {minutes: 1},
      });
    } else {
      // if the scheduler is not enabled, then perform an initial sync to populate data - otherwise there will be no data until an endpoint is called
      this.importAllDiscoveredEntities();
    }
  }

  toDasboardComponentEntity(): ComponentEntityV1alpha1 {
    return {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: `tyk-dashboard-${this.dashboardName}`,
        description: 'Tyk Dashboard',
        annotations: {
          [ANNOTATION_LOCATION]: `url:${this.dashboardConfig?.host}`,
          [ANNOTATION_ORIGIN_LOCATION]: `url:${this.dashboardConfig?.host}`,
        },
        links: [
          {
            url: `${this.dashboardConfig?.host}`,
            title: 'Tyk Dashboard',
            icon: 'dashboard',
            type: 'admin-dashboard',
          }
        ],
      },
      spec: {
        type: 'website',
        lifecycle: `${this.dashboardConfig?.defaults?.lifecycle || ''}`,
        owner: `${this.dashboardConfig?.defaults?.owner || ''}`,
        subcomponentOf: 'tyk',
        system: 'tyk',
        providesApis: ['tyk-dashboard-api', 'tyk-dashboard-admin-api', 'tyk-dashboard-system-api'],
        consumesApis: ['default/tyk-gateway-api'],
        dependsOn: [
          'component:default/tyk-gateway',
          'resource:default/tyk-dashboard-storage',
        ]
      }
    };
  }

  toGatewayComponentEntity(apis: API[], gateway: enrichedGateway): ComponentEntityV1alpha1 {
    this.logger.info(`Gateway ${gateway.id}, segmented ${gateway.segmented} with tags ${JSON.stringify(gateway.tags)}`);

    const provides: string[] = apis.map((api: API) => {
      const apiEntityName = `${kebabCase(this.dashboardName)}-${api.api_definition.api_id}`;
      if (!gateway.segmented) {
        return apiEntityName;
      }

      // if the gateway is segmented, then the api is provided if the api has a tag that matches a tag on the gateway
      for (const tag of gateway.tags) {
        if (api.api_definition.tags.includes(tag)) {
          return apiEntityName;
        }
      }
      return 'REMOVEME';
    }).filter((value: string) => value != 'REMOVEME');

    this.logger.info(`Gateway ${gateway.id} with tags ${JSON.stringify(gateway.tags)} provides ${JSON.stringify(provides)} APIs`)

    return {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: `tyk-gateway-${this.dashboardName}-${gateway.id}`,
        title: `Tyk Gateway ${gateway.id}`,
        description: `Tyk Gateway ${this.dashboardName} ${gateway.id}`,
        // links: [
        //   {
        //     url: `http://${node.hostname}`,
        //     title: 'Tyk Gateway',
        //     icon: 'dashboard',
        //     type: 'admin-dashboard',
        //   }
        // ],
        annotations: {
          [ANNOTATION_LOCATION]: `url:http://tyk-backstage-entity-provider`,
          [ANNOTATION_ORIGIN_LOCATION]: `url:http://tyk-backstage-entity-provider`,
        },
      },
      spec: {
        type: 'website',
        lifecycle: `${this.dashboardConfig?.defaults?.lifecycle || ''}`, // inherit from dashboard
        owner: `${this.dashboardConfig?.defaults?.owner || ''}`, // inherit from dashboard
        subcomponentOf: `tyk-dashboard-${this.dashboardName}`,
        system: 'tyk',
        providesApis: provides,
      }
    }
  }

  convertApiToResource(api: API, config: TykDashboardConfig): ApiEntityV1alpha1 {
    let resourceTitle = api.api_definition.name;
    let resourceTags: string[] = [];
    const tykCategoryPrefix = '#';

    if (api.api_definition.name.includes(tykCategoryPrefix)) {
      this.logger.debug(`Performing category extraction for Tyk API "${api.api_definition.name}"`);
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

    this.logger.debug(`Generating Tyk API resource for "${resourceTitle}"`);

    // if there is no defaultOwner and the api definition config_data does not provide an owner,
    // then we need to throw an error in the logs and skip this particular API definition
    const owner: string = api.api_definition.config_data?.backstage?.owner ?? (config.defaults?.owner || "");
    if (owner === "") {
      this.logger.error(`No owner found for Tyk API "${api.api_definition.name}" and no default owner configured, skipping`);
      throw new Error(`No owner found for Tyk API "${api.api_definition.name}" and no default owner configured, skipping`);
    }
    const lifecycle: string = api.api_definition.config_data?.backstage?.lifecycle ?? (config.defaults?.lifecycle || "");
    if (lifecycle === "") {
      this.logger.error(`No lifecycle found for Tyk API "${api.api_definition.name}" and no default lifecycle configured, skipping`);
      throw new Error(`No lifecycle found for Tyk API "${api.api_definition.name}" and no default lifecycle configured, skipping`);
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
        tags: this.tykConfig.importCategoriesAsTags ? resourceTags : [],
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
      this.logger.debug(`${resourceTitle} contains Backstage label data`);
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

  async discoverAllEntities(): Promise<DeferredEntity[]> {
    this.logger.info(`creating dashboard component for (${this.dashboardName})`);

    const deferredEntities: DeferredEntity[] = [];

    const dashboardComponentEntity: ComponentEntityV1alpha1 = this.toDasboardComponentEntity();
    deferredEntities.push({
      entity: dashboardComponentEntity,
      locationKey: `tyk-dashboard-${this.dashboardName}`,
    });

    // discover the apis
    const apis: API[] = await this.dashboardClient.getApiList();
    const apiEntities: ApiEntityV1alpha1[] = apis.map((api: API) => {
      return this.convertApiToResource(api, this.dashboardClient.getConfig());
    });
    deferredEntities.push(...apiEntities.map((entity: ApiEntityV1alpha1): DeferredEntity => ({
      entity: entity,
      locationKey: `tyk-api-${this.dashboardName}-${entity.metadata.name}`,
    })));

    const enrichedGateways: enrichedGateway[] = [];
    const systemNodes = await this.dashboardClient.getSystemNodes();
    for (const node of systemNodes.data.nodes) {
      let gateway = await this.dashboardClient.getGateway({node_id: node.id, hostname: node.hostname});
      enrichedGateways.push({
        id: node.id,
        hostname: node.hostname,
        segmented: gateway.data.db_app_conf_options.node_is_segmented,
        tags: gateway.data.db_app_conf_options.tags,
      });
    }
    const gatewayComponentEntities: ComponentEntityV1alpha1[] = enrichedGateways.map((gateway: enrichedGateway): ComponentEntityV1alpha1 => {
      return this.toGatewayComponentEntity(apis, gateway);
    });
    deferredEntities.push(...gatewayComponentEntities.map((entity: ComponentEntityV1alpha1): DeferredEntity => ({
      entity: entity,
      locationKey: `tyk-gateway-${this.dashboardName}-${entity.metadata.name}`,
    })));

    return deferredEntities;
  }

  async importAllDiscoveredEntities(): Promise<void> {
    const deferredEntities: DeferredEntity[] = await this.discoverAllEntities()
    await this.connection!.applyMutation({
      type: 'full',
      entities: deferredEntities,
    });
  }

  async importAllApis(): Promise<void> {
    this.logger.info(`Importing APIs from ${this.dashboardName}`);

    if (!this.connection) {
      throw new Error('Not initialized');
    }
    let allAPIs: API[] = await this.dashboardClient.getApiList();

    let allAPIResources: ApiEntityV1alpha1[] = allAPIs.map((api: API) => {
      return this.convertApiToResource(api, this.dashboardClient.getConfig());
    });

    if (!allAPIResources || allAPIResources.length == 0) {
      this.logger.info('No Tyk resources to apply');
      return;
    }

    this.logger.info(`Applying ${allAPIResources.length} Tyk API resources to catalog`);

    await this.connection.applyMutation({
      type: 'full',
      entities: allAPIResources.map((entity: ApiEntityV1alpha1): { entity: any, locationKey: any } => ({
        entity,
        locationKey: `${this.getProviderName()}`,
      })),
    });
  }

  /**
   * @deprecated Currently not in use. Originally created to service incoming webhook payloads for single-dashboard setups,
   * but the move to multi-dashboard setups made it impractical to match incoming payloads to a particular dashboard configuration.
   * Leaving functionality in place in case of future use case.
   * @todo We are always taking the first dashboard config in order to just make it kind of work, but this is a bug -
   * we should be be able to determine which dashboard config to use, perhaps by including it in the importApi
   * function signature.
   */
  async importApi(api: API): Promise<void> {
    this.logger.info('Importing single API from Tyk');

    if (!this.connection) {
      throw new Error('Not initialized');
    }

    const apiResource: ApiEntityV1alpha1 = this.convertApiToResource(api, this.dashboardClient.getConfig());
    this.logger.info(`Applying "${apiResource.metadata.title}" Tyk API resource to catalog`);
    let apiResources: ApiEntityV1alpha1[] = [apiResource];

    // the mutation in this function uses a 'delta' approach, so will be overwritten by mutations that use the 'full' approach
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
