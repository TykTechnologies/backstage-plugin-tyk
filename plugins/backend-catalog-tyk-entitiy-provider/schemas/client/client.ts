import {API, APIListResponse, APIListResponseSchema, TykDashboardConfig} from "../schemas";
import {Logger} from "winston";

export class DashboardClient {

  private config: TykDashboardConfig;
  private log: Logger;

  constructor(props: {cfg: TykDashboardConfig, log: Logger}) {
    this.config = props.cfg;
    this.log = props.log;
  }

  async getApiList(): Promise<API[]> {

    const res: Response = await fetch(`${this.config.host}/api/apis?p=-1`, {
      headers: {
        Authorization: `${this.config.token}`
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

  getConfig(): TykDashboardConfig {
    return this.config;
  }
}
