/*
 * Copyright 2020 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {
  ANNOTATION_LOCATION,
  ANNOTATION_ORIGIN_LOCATION,
  ApiEntityV1alpha1
} from '@backstage/catalog-model'
import {
  EntityProvider,
  EntityProviderConnection,
} from '@backstage/plugin-catalog-node';
import { Logger } from 'winston';
import { Config } from '@backstage/config';
import { kebabCase } from 'lodash'

type ApiDefinition = {
  id: string
  name: string
}

export class TykEntityProvider
  implements EntityProvider {
  private readonly env: string;
  private readonly logger: Logger;
  private readonly dashboardApiHost: string;
  private readonly dashboardApiToken: string;
  private connection?: EntityProviderConnection;

  constructor(opts: {
    logger: Logger
    env: string
    config: Config
  }) {
    const { logger, env, config } = opts
    this.logger = logger
    this.env = env
    this.dashboardApiHost = config.getString('tyk.dashboardApi.host')
    this.dashboardApiToken = config.getString('tyk.dashboardApi.token')

    this.logger.info(`Tyk Dashboard Host: ${this.dashboardApiHost}`)
    this.logger.info(`Tyk Dashboard Token: ${this.dashboardApiToken.slice(0, 4)} (first 4 characters)`)
  }

  async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection
  }

  getProviderName(): string {
    return `tyk-entity-provider-${this.env}`
  }

  async getAllApis(): Promise<ApiDefinition[]> {
    // this is an example, that just fetches the first page of APIs
    const response = await fetch(`${this.dashboardApiHost}/api/apis`, { headers: { Authorization: `${this.dashboardApiToken}` } })
    const data = await response.json()
    const apis = data.apis
    const apiData: ApiDefinition[] = []

    if (response.status != 200) {
      this.logger.error(`Error fetching API definitions from ${this.dashboardApiHost}: ${response.status} ${response.statusText}`)
    } else {
      if (apis == undefined) {
        this.logger.warn(`No API definitions found at ${this.dashboardApiHost}.`)
      } else {
        apis.forEach((api: { api_definition: { api_id: any; name: any; }; }) => {
          apiData.push({
            id: api.api_definition.api_id,
            name: api.api_definition.name
          });
        });
      }
    }

    return apiData;
  }

  convertApisToResources(apis: ApiDefinition[]): ApiEntityV1alpha1[] {
    const apiResources: ApiEntityV1alpha1[] = []

    for (const api of apis) {
      this.logger.info(`Processing ${api.name}`)

      // this is a simplistic API CRD, for purpose of demonstration
      apiResources.push({
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'API',
        metadata: {
          annotations: {
            [ANNOTATION_LOCATION]: 'tyk-api-http://localhost:3000/',
            [ANNOTATION_ORIGIN_LOCATION]: 'tyk-api-http://localhost:3000/',
            'tyk-id': api.id,
          },
          name: kebabCase(api.name),
          title: api.name,
        },
        spec: {
          type: 'http',
          system: 'tyk',
          owner: 'guests',
          lifecycle: 'experimental',
          definition: 'openapi: "3.0.0"'
        },
      })
    }

    return apiResources
  }

  async run(): Promise<void> {
    this.logger.info("Running Tyk Entity Provider")

    if (!this.connection) {
      throw new Error('Not initialized');
    }

    const apis = await this.getAllApis()
    const apiResources = this.convertApisToResources(apis)

    await this.connection.applyMutation({
      type: 'full',
      entities: apiResources.map((entity) => ({
        entity,
        locationKey: `${this.getProviderName()}`,
      })),
    })
  }
}