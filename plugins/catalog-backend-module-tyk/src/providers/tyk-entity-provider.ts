import {
  ANNOTATION_EDIT_URL,
  ANNOTATION_LOCATION,
  ANNOTATION_ORIGIN_LOCATION,
  ANNOTATION_SOURCE_LOCATION,
  ANNOTATION_VIEW_URL,
  ApiEntityV1alpha1, ComponentEntityV1alpha1, SystemEntityV1alpha1
} from '@backstage/catalog-model'
import {DeferredEntity, EntityProvider, EntityProviderConnection,} from '@backstage/plugin-catalog-node';
import {Logger} from 'winston';
import {Router} from 'express';
import {PluginTaskScheduler} from '@backstage/backend-tasks';
import {kebabCase} from 'lodash';
import yaml from 'js-yaml';
import {API, TykDashboardConfig, TykConfig, TykGlobalOptionsConfig, enrichedGateway} from "../clients/schemas";
import {TykDashboardClient} from "../clients/tyk-dashboard-client";
import { Config } from '@backstage/config';
import { string } from 'zod';
import { readTykConfiguration } from './config';

export class TykEntityProvider implements EntityProvider {
  private readonly logger: Logger;
  private connection?: EntityProviderConnection;
  private dashboardClient: TykDashboardClient;
  private readonly dashboardConfig: TykDashboardConfig;
  private readonly globalOptionsConfig: TykGlobalOptionsConfig;
  private readonly defaultSchedulerFrequency = 5;

  static fromConfig(
    config: Config,
    logger: Logger,
  ): TykEntityProvider[] {
    const tykConfig = readTykConfiguration(config);
    let tykEntityProviders: TykEntityProvider[] = [];

    tykConfig.dashboards.forEach((tykDashboardConfig: TykDashboardConfig) => {
      tykEntityProviders.push(new TykEntityProvider({
        logger: logger,
        globalOptionsConfig: tykConfig.globalOptions,
        dashboardConfig: tykDashboardConfig,
      }));
    });

    return tykEntityProviders;
  }

  constructor(props: { logger: Logger; globalOptionsConfig: TykGlobalOptionsConfig, dashboardConfig: TykDashboardConfig }) {
    this.logger = props.logger;
    this.globalOptionsConfig = props.globalOptionsConfig;
    this.dashboardConfig = props.dashboardConfig;
    this.dashboardClient = new TykDashboardClient({
      log: props.logger,
      cfg: this.dashboardConfig,
    });
  }

  async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection;
  }

  getProviderName(): string {
    return `tyk-entity-provider-${this.dashboardConfig.name}`;
  } 

  async init(router: Router, scheduler: PluginTaskScheduler): Promise<void> {
    this.logger.debug(`Initializing Tyk entity provider for ${this.dashboardConfig.name} Dashboard`);

    if (!this.connection) {
      throw new Error('Not initialized');
    }

    if (!this.globalOptionsConfig.router.enabled && !this.globalOptionsConfig.scheduler.enabled) {
      throw new Error(`Tyk entity provider has no methods enabled for data collection - no data will be imported`);
    }

    try {
      if (await this.dashboardClient.checkDashboardConnectivity()) {
        this.logger.debug(`Found Tyk Dashboard ${this.dashboardConfig.name}`);      
      } else {
        this.logger.error(`Tyk ${this.dashboardConfig.name} Dashboard failed connectivity check - check that configuration is correct`);
      }
    } catch (error) {
      this.logger.error(`Error performing connectivity check for Tyk ${this.dashboardConfig.name} Dashboard:`, error);
    }

    if (this.globalOptionsConfig.router.enabled) {
      this.logger.debug("Registering Tyk entity provider routes");
      // for importing all APIs from the Tyk Dashboard, for both GET and POST
      // the POST request is to support webhook calls from Tyk Dashboard
      // these routes are accessible via the catalog api path /api/catalog/tyk/[dashboard-config-name]/sync
      router.get(`/tyk/${this.dashboardConfig.name}/sync`, async (_req, res) => {
        await this.importAllDiscoveredEntities();
        res.status(200).end();
      });
      router.post(`/tyk/${this.dashboardConfig.name}/sync`, async (_req, res) => {
        await this.importAllDiscoveredEntities();
        res.status(200).end();
      });
    }

    if (this.globalOptionsConfig.scheduler.enabled) {
      this.logger.debug("Scheduling Tyk entity provider task");

      let frequency: number = this.globalOptionsConfig.scheduler.frequency || this.defaultSchedulerFrequency;

      await scheduler.scheduleTask({
        id: 'run_tyk_entity_provider_refresh',
        fn: async () => {
          await this.importAllDiscoveredEntities();
        },
        frequency: {minutes: frequency},
        timeout: {minutes: 1},
      });
    }

    // perform an initial sync to populate data, so that data is available immediately
    await this.importAllDiscoveredEntities();

    this.logger.info(`Tyk entity provider initialized for ${this.dashboardConfig.name} Dashboard`);
  }

  toDashboardComponentEntity(): ComponentEntityV1alpha1 {
    return {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: `tyk-dashboard-${this.dashboardConfig.name}`,
        title: `Tyk Dashboard: ${this.dashboardConfig.name}`,
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
        system: `${this.dashboardConfig?.defaults?.system || ''}`,
        providesApis: [`tyk-dashboard-api-${this.dashboardConfig.name}`, `tyk-dashboard-admin-api-${this.dashboardConfig.name}`, `tyk-dashboard-system-api-${this.dashboardConfig.name}`],
        consumesApis: [`default/tyk-gateway-api-${this.dashboardConfig.name}`],
        dependsOn: [
          `component:default/tyk-gateway-${this.dashboardConfig.name}`,
          `resource:default/tyk-dashboard-storage-${this.dashboardConfig.name}`,
        ]
      }
    };
  }

  toGatewayComponentEntity(apis: API[], gateway: enrichedGateway): ComponentEntityV1alpha1 {
    const provides: string[] = apis.reduce((collector: string[], api: API) => {
      const apiEntityName = `${kebabCase(this.dashboardConfig.name)}-${api.api_definition.api_id}`;
      if (!gateway.segmented) {
        return [...collector, apiEntityName];
      }

      // if the gateway is segmented, then the api is provided if the api has a tag that matches a tag on the gateway
      for (const tag of gateway.tags) {
        if (api.api_definition.tags.includes(tag)) {
          return [...collector, apiEntityName];
        }
      }
      return collector;
    }, []);
    
    this.logger.debug(`Generating entity for Tyk Gateway ${gateway.id} from ${this.dashboardConfig.name} Dashboard, hosted on ${gateway.hostname} and is ${gateway.segmented ? `segmented with tags ${JSON.stringify(gateway.tags)}`:"not segmented"}, providing ${provides.length} APIs: ${JSON.stringify(provides)}`);

    return {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: `tyk-gateway-${this.dashboardConfig.name}-${gateway.id}`,
        title: `Tyk Gateway: ${gateway.hostname}`,
        description: `Tyk Gateway ${this.dashboardConfig.name} ${gateway.hostname} ${gateway.id}`,
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
        type: 'service',
        lifecycle: `${this.dashboardConfig?.defaults?.lifecycle || ''}`, // inherit from dashboard
        owner: `${this.dashboardConfig?.defaults?.owner || ''}`, // inherit from dashboard
        subcomponentOf: `tyk-dashboard-${this.dashboardConfig.name}`,
        system: `${this.dashboardConfig?.defaults?.system || ''}`, // inherit from dashboard
        providesApis: provides,
      }
    }
  }

  toApiEntity(api: API, config: TykDashboardConfig): ApiEntityV1alpha1 {
    let title: string = api.api_definition.name;
    let tags: string[] = [];

    const tykCategoryPrefix = '#';

    if (api.api_definition.name.includes(tykCategoryPrefix)) {
      this.logger.debug(`Performing category extraction for Tyk API "${api.api_definition.name}"`);
      api.api_definition.name.split(tykCategoryPrefix).forEach((value, index) => {
        switch (index) {
          case 0:
            title = value.trim();
            break;
          default:
            tags.push(value.trim());
            break;
        }
      });
    }

    this.logger.debug(`Generating Tyk API entity for "${title}" from ${this.dashboardConfig.name} Dashboard`);

    // if there is no defaultOwner and the api definition config_data does not provide an owner,
    // then we need to throw an error in the logs and skip this particular API definition
    const owner: string = api.api_definition.config_data?.backstage?.owner ?? (config.defaults?.owner || "");
    if (owner === "") {
      this.logger.warn(`No owner found for Tyk API "${api.api_definition.name}" and no default owner configured, skipping`);
    }
    const lifecycle: string = api.api_definition.config_data?.backstage?.lifecycle ?? (config.defaults?.lifecycle || "");
    if (lifecycle === "") {
      this.logger.warn(`No lifecycle found for Tyk API "${api.api_definition.name}" and no default lifecycle configured, skipping`);
    }

    // name is composed of a namespace and an api id, the namespace is taken from the Tyk dashboard configuration
    // this is to avoid collisions between identical APIs in different Tyk dashboards
    const name: string = `${kebabCase(config.name)}-${api.api_definition.api_id}`;
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
    let apiEntity: ApiEntityV1alpha1 = {
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
          'tyk.io/name': kebabCase(title),
          'tyk.io/authentication': authMechamism(api),
        },
        tags: this.globalOptionsConfig.importCategoriesAsTags ? tags : [],
        name: name,
        title: title,
      },
      spec: {
        type: 'tyk', // default to Tyk API definition, but reset later if needed
        system: api.api_definition.config_data?.backstage?.system ?? config.defaults?.system,
        owner: api.api_definition.config_data?.backstage?.owner ?? (config.defaults?.owner || ""),
        lifecycle: api.api_definition.config_data?.backstage?.lifecycle ?? (config.defaults?.lifecycle || ""),
        definition: JSON.stringify(api.api_definition),
      },
    };

    // reset specific fields if the API is not a standard Tyk API definition 
    if (typeof api.oas == "object") {
      apiEntity.spec.type = 'openapi';
      apiEntity.spec.definition = yaml.dump(api.oas);
      linkPathPart = "oas";
    } else if (api.api_definition.graphql?.enabled === true) {
      apiEntity.spec.type = 'graphql';
      apiEntity.spec.definition = api.api_definition.graphql?.schema;
    }

    // add custom labels, if any exist
    if (api.api_definition.config_data?.backstage?.labels) {
      this.logger.debug(`Tyk API "${title}" contains Backstage label data`);
      for (const label of api.api_definition.config_data?.backstage?.labels!) {
        // use to 'tyk.io/' prefix to distinguish that the labels are from Tyk
        // this is best practice for open-source plugins, so that Tyk labels can be distinguished from others
        apiEntity.metadata.labels!["tyk.io/" + label.key] = label.value;
      }
    }

    return apiEntity;
  }

  async discoverAllEntities(): Promise<DeferredEntity[]> {
    this.logger.debug(`Discovering Tyk entities for ${this.dashboardConfig.name} Dashboard`);

    const deferredEntities: DeferredEntity[] = [];

    if (await this.dashboardClient.checkDashboardConnectivity()) {
      this.logger.debug(`Found Tyk Dashboard ${this.dashboardConfig.name}`);      
    } else {
      throw new Error(`Could not connect to Tyk ${this.dashboardConfig.name} Dashboard`);
    }  

    const dashboardComponentEntity: ComponentEntityV1alpha1 = this.toDashboardComponentEntity();
    deferredEntities.push({
      entity: dashboardComponentEntity,
      locationKey: `${this.getProviderName}`,
    });

    // discover the APIs
    let apis: API[] = []
    apis = await this.dashboardClient.getApiList();
    const apiEntities: ApiEntityV1alpha1[] = apis.map((api: API) => {
      return this.toApiEntity(api, this.dashboardClient.getConfig());
    });

    if (apiEntities == undefined || apiEntities.length == 0) {
      this.logger.warn(`No Tyk API definitions found at ${this.dashboardConfig.name} Dashboard`);
    }

    deferredEntities.push(...apiEntities.map((entity: ApiEntityV1alpha1): DeferredEntity => ({
      entity: entity,
      locationKey: `${this.getProviderName}`,
    })));

    this.logger.debug(`Found ${apiEntities.length} Tyk API${apiEntities.length == 1 ? "" : "s"} in ${this.dashboardConfig.name} Dashboard`);

    // discover the gateways
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

    if (enrichedGateways == undefined || enrichedGateways.length == 0) {
      this.logger.warn(`No Tyk Gateways found at ${this.dashboardConfig.name} Dashboard`);
    }

    this.logger.debug(`Found ${enrichedGateways.length} Tyk Gateway${enrichedGateways.length == 1 ? "" : "s"} in ${this.dashboardConfig.name} Dashboard`);

    const gatewayComponentEntities: ComponentEntityV1alpha1[] = enrichedGateways.map((gateway: enrichedGateway): ComponentEntityV1alpha1 => {
      return this.toGatewayComponentEntity(apis, gateway);
    });

    deferredEntities.push(...gatewayComponentEntities.map((entity: ComponentEntityV1alpha1): DeferredEntity => ({
      entity: entity,
      locationKey: `${this.getProviderName}`,
    })));

    return deferredEntities;
  }

  async importAllDiscoveredEntities(): Promise<void> {
    // try/catch block is used to avoid performing a sync if an error occurs, as it could result in an incorrect data mutation
    try {
      const deferredEntities: DeferredEntity[] = await this.discoverAllEntities()
      this.logger.info(`Importing ${deferredEntities.length} Tyk ${deferredEntities.length == 1 ? "entity" : "entities"} from ${this.dashboardConfig.name} Dashboard`);
      await this.connection!.applyMutation({
        type: 'full',
        entities: deferredEntities,
      });        
    } catch (error) {
      this.logger.error(`Error importing Tyk entities from ${this.dashboardConfig.name} Dashboard:`, error);
    }
  }
}
