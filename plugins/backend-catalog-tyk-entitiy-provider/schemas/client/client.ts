import {API, APIListResponse, APIListResponseSchema, TykDashboardConfig} from "../schemas";
import {Logger} from "winston";

export class DashboardClient {

  private config: TykDashboardConfig;
  private log: Logger;
  readonly name: string;

  constructor(props: {cfg: TykDashboardConfig, log: Logger}) {
    this.config = props.cfg;
    this.log = props.log;
    this.name = props.cfg.name;
  }

  async getApiList(): Promise<API[]> {

    const res: Response = await fetch(`${this.config.host}/api/apis?p=-1`, {
      headers: {
        Authorization: this.config.token
      }
    });

    const data: APIListResponse = await res.json();

    if (res.status != 200) {
      switch (res.status) {
        case 401:
          this.log.error(`Authorisation failed with Tyk ${this.config.name} - check that 'token' is correctly configured in 'tyk.dashboard' app config settings`);
          return [];
        default:
          this.log.error(`Error fetching API definitions from ${this.config.name}: ${res.status} ${res.statusText}`);
          return [];
      }
    }

    if (data.apis == undefined) {
      this.log.warn(`No API definitions found at ${this.config.name}.`);
      return [];
    }

    return APIListResponseSchema.parse(data).apis;
  }

  async createApi(api: API): Promise<boolean> {
    const response = await fetch(`${this.config.host}/api/apis`, {
      method: 'POST',
      headers: {
        Authorization: this.config.token
      },
      body: JSON.stringify(api)
    });

    const data = await response.json();
    if (response.status != 200) {
      this.log.error(`Error adding API ${api.api_definition.name} to ${this.config.name}:` + data);
      return false;
    }

    this.log.info(`Added API ${api.api_definition.name} to ${this.config.name}`);
    return true;
  }

  getConfig(): TykDashboardConfig {
    return this.config;
  }
}
