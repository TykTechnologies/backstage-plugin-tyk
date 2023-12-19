import {NodeDetail, NodeDetailSchema, SystemNode, SystemNodeSchema} from "../model/nodes";
import {Logger} from 'winston';
import {API, APIListResponse, APIListResponseSchema} from "../model/apis";

export class DashboardClient {
  private readonly logger: Logger;
  private readonly dashboardApiHost: string;
  private readonly dashboardApiToken: string;
  // private connection?: EntityProviderConnection;

  constructor(opts: { logger: Logger; dashboardAPIToken : string; dashboardAPIHost : string; }) {
    const {logger, dashboardAPIToken, dashboardAPIHost} = opts;
    this.logger = logger;

    this.dashboardApiToken = dashboardAPIToken;
    this.dashboardApiHost = dashboardAPIHost;

    this.logger.info(`Tyk Dashboard Host: ${this.dashboardApiHost}`)
    this.logger.info(`Tyk Dashboard Token: ${this.dashboardApiToken.slice(0, 4)} (first 4 characters)`)
  }

  async getSystemNodes(): Promise<SystemNode> {
    const response = await fetch(`${this.dashboardApiHost}/api/system/nodes`,
      { headers: { Authorization: `${this.dashboardApiToken}` } }
    )
    const data: SystemNode = await response.json();

    if (response.status != 200) {
      switch (response.status) {
        case 401:
          this.logger.error(`Authorisation failed with Tyk Dashboard ${this.dashboardApiHost} - check that 'tyk.dashboardApi.token' app config setting is correct`)
          break;
        default:
          this.logger.error(`Error fetching system nodes from ${this.dashboardApiHost}: ${response.status} ${response.statusText}`)
          break;
      }
    } else {
      SystemNodeSchema.parse(data)
    }

    return data;
  }

  async getNodeDetail(nodeID: string, nodeHostname: string): Promise<NodeDetail> {
    const res: Response = await fetch(`${this.dashboardApiHost}/api/system/node/${nodeID}/${nodeHostname}`,
      { headers: { Authorization: `${this.dashboardApiToken}` } }
    )
    const data: NodeDetail = await res.json();

    if (res.status != 200) {
      switch (res.status) {
        case 404:
          this.logger.error(`Node ${nodeID}/${nodeHostname} not found`);
          break;
        case 401:
          this.logger.error(`Not authorized`);
          break;
        default:
          this.logger.error(`Error fetching node detail: ${res.status} ${res.statusText}`)
          break;
      }
    } else {
      NodeDetailSchema.parse(data)
    }

    return data;
  }

  async getAllApis(): Promise<API[]> {
    // this is an example, that just fetches the first page of APIs
    const response = await fetch(`${this.dashboardApiHost}/api/apis`,
      { headers: { Authorization: `${this.dashboardApiToken}` } }
    )
    const data: APIListResponse = await response.json();

    if (response.status != 200) {
      switch (response.status) {
        case 401:
          this.logger.error(`Authorisation failed with Tyk Dashboard ${this.dashboardApiHost} - check that 'tyk.dashboardApi.token' app config setting is correct`)
          break;
        default:
          this.logger.error(`Error fetching API definitions from ${this.dashboardApiHost}: ${response.status} ${response.statusText}`)
          break;
      }
    } else {
      if (data.apis == undefined) {
        this.logger.warn(`No API definitions found at ${this.dashboardApiHost}.`)
      } else {
        APIListResponseSchema.parse(data)
      }
    }

    return data.apis;
  }
}
