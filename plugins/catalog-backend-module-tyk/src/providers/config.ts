import { Config } from '@backstage/config';

import {TykDashboardConfig, TykConfig} from "../clients/schemas";


export function readTykConfiguration(config: Config): TykConfig
{
   const tykConfig: TykConfig = config.get("tyk");
   return tykConfig;
}

export function readTykDashboardConfiguration(config: Config, dashboardName: string): TykDashboardConfig
{
    const tykConfig = readTykConfiguration(config);
    const dashboardConfig = tykConfig.dashboards.find((dashboard: TykDashboardConfig): boolean => dashboard.name == dashboardName)!;
    return dashboardConfig;
}