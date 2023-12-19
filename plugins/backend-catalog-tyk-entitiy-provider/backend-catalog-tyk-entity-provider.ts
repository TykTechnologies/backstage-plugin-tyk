import {
  ANNOTATION_LOCATION,
  ANNOTATION_ORIGIN_LOCATION,
  ApiEntityV1alpha1,
  ComponentEntityV1alpha1,
} from '@backstage/catalog-model'
import {
  EntityProvider,
  EntityProviderConnection,
} from '@backstage/plugin-catalog-node';

import {Logger} from 'winston';
import {Config} from '@backstage/config';
import {kebabCase} from 'lodash';
import yaml from 'js-yaml';
import {NodeDetail, SystemNode} from "./model/nodes";
import {DashboardClient} from "./client/dashboard";
import {API} from "./model/apis";

export class TykEntityProvider implements EntityProvider {
  private readonly env: string;
  private readonly logger: Logger;
  private readonly dashboardApiHost: string;
  private readonly dashboardApiToken: string;
  private connection?: EntityProviderConnection;
  private readonly dashboardClient: DashboardClient;

  constructor(opts: { logger: Logger; env: string; config: Config }) {
    const {logger, env, config} = opts;
    this.logger = logger;
    this.env = env;

    this.dashboardApiToken = config.getString('tyk.dashboardApi.token')
    this.dashboardApiHost = config.getString('tyk.dashboardApi.host')

    this.dashboardClient = new DashboardClient({
      logger: this.logger,
      dashboardAPIToken: this.dashboardApiToken,
      dashboardAPIHost: this.dashboardApiHost,
    });

    this.logger.info(`Tyk Dashboard Host: ${this.dashboardApiHost}`)
    this.logger.info(`Tyk Dashboard Token: ${this.dashboardApiToken.slice(0, 4)} (first 4 characters)`)
  }

  async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection
  }

  getProviderName(): string {
    return `tyk-entity-provider-${this.env}`
  }

  async importGatewayNodes(): Promise<void> {
    this.logger.info("Importing connected gateways from Tyk Dashboard")

    if (!this.connection) {
      throw new Error('Not initialized');
    }

    const apis: API[] = await this.dashboardClient.getAllApis();

    const systemNodes: SystemNode = await this.dashboardClient.getSystemNodes();
    if (systemNodes.data.active_node_count == 0) {
      this.logger.warn("No connected gateways to process, aborting import")
      return
    }

    let gatewayNodes: ComponentEntityV1alpha1[] = [];

    for (const node of systemNodes.data.nodes) {
      this.logger.info(`Processing ${node.id} ${node.hostname}`)

      let nodeDetail: NodeDetail = await this.dashboardClient.getNodeDetail(node.id, node.hostname)

      let providesApis: string[] = ['tyk-gateway-api']
      if (nodeDetail.data.db_app_conf_options.node_is_segmented) {
        this.logger.info(`Node ${node.id} ${node.hostname} is segmented, will provide APIs ${JSON.stringify(nodeDetail.data.db_app_conf_options.tags)}`)

        let loads = apis.some((api) => nodeDetail.data.db_app_conf_options.tags.includes()

        apiResources.forEach((api) => {
          if (api.spec.definition) {
            providesApis.push(`${api.metadata.uid}`)
          }
        });
      } else {
        apiResources.forEach((api) => {
          providesApis.push(`${api.metadata.uid}`)
        });
      }

      gatewayNodes.push({
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          annotations: {
            [ANNOTATION_LOCATION]: 'tyk-gateway-http://localhost:8080/',
            [ANNOTATION_ORIGIN_LOCATION]: 'tyk-gateway-http://localhost:8080/',
            'tyk-gateway-id': node.id,
          },
          labels: {
            'id': node.id,
            'hostname': node.hostname,
          },
          name: node.id,
          title: node.hostname,
        },
        spec: {
          type: 'service',
          lifecycle: 'production',
          owner: 'guests',
          providesApis: providesApis,
          system: 'tyk',
          consumesApis: ['default/tyk-dashboard-system-api'],
          dependsOn: ['component:default/tyk-dashboard', 'resource:default/tyk-gateway-storage'],
        },
      });
    }

    await this.connection.applyMutation({
      type: 'full',
      entities: gatewayNodes.map((entity) => ({
        entity,
        locationKey: `${this.getProviderName()}`,
      })),
    });
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
      apiResources.push({
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'API',
        metadata: {
          annotations: {
            [ANNOTATION_LOCATION]: 'tyk-api-http://localhost:3000/',
            [ANNOTATION_ORIGIN_LOCATION]: 'tyk-api-http://localhost:3000/',
            'tyk-api-id': api.api_definition.api_id,
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
          labels: {
            'active': api.api_definition.active.toString(),
            'api_id': api.api_definition.api_id,
            'name': kebabCase(api.api_definition.name),
            'authentication': authMechamism(api),
            'tags': JSON.stringify(api.api_definition.tags),
          },
          name: api.api_definition.api_id,
          title: api.api_definition.name,
        },
        spec: spec,
      })
    }

    return apiResources
  }

  async importAllApis(): Promise<void> {
    this.logger.info("Importing all APIs from Tyk Dashboard")

    if (!this.connection) {
      throw new Error('Not initialized');
    }

    const apis: API[] = await this.dashboardClient.getAllApis();

    if (apis == null || apis.length == 0) {
      this.logger.warn("No APIs to process, aborting import")
      return
    }
    const apiResources: ApiEntityV1alpha1[] = this.convertApisToResources(apis)

    await this.connection.applyMutation({
      type: 'full',
      entities: apiResources.map((entity) => ({
        entity,
        locationKey: `${this.getProviderName()}`,
      })),
    })
  }

  // NOTE: the mutation in this function uses a 'delta' approach, so will be overwritten by mutations that use the 'full' approach
  async importApi(api: API): Promise<void> {
    this.logger.info('Importing single API');

    if (!this.connection) {
      throw new Error('Not initialized');
    }

    // reuse existing functionality, which was designed to accept an array of APIs
    const apiResources = this.convertApisToResources([api])

    await this.connection.applyMutation({
      type: 'delta',
      added: apiResources.map((entity) => ({
        entity,
        locationKey: `${this.getProviderName()}`,
      })),
      removed: []
    })
  }
}
