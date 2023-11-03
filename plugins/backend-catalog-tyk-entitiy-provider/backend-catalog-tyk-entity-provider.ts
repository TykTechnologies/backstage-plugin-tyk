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
    EntityProvider,
    EntityProviderConnection,
  } from '@backstage/plugin-catalog-node';
  import { Logger } from 'winston';
  import { UrlReader } from '@backstage/backend-common';

  export class TykEntityProvider
    implements EntityProvider
  {
    private readonly env: string;
    private readonly logger: Logger;
    private readonly reader: UrlReader;
    private connection?: EntityProviderConnection;

    constructor(opts: {
      logger: Logger;
      env: string;
      reader: UrlReader;
    }) {
      const { logger, env, reader } = opts;
      this.logger = logger;
      this.env = env;
      this.reader = reader;
    }
  
    async connect(connection: EntityProviderConnection): Promise<void> {
      this.connection=connection
    }
  
    getProviderName(): string {
      return `tyk-entity-provider-${this.env}`;
    }

    async run(): Promise<void> {
        this.logger.info("Running Tyk Entity Provider")
        
        if (!this.connection) {
          throw new Error('Not initialized');
        }
    
        // TODO: get tyk data

        
        // const response = await this.reader.readUrl(
        //   `https://frobs-${this.env}.example.com/data`,
        // );
        // const data = JSON.parse(await response.buffer()).toString();
    
        /** [5] */
        // const entities: Entity[] = frobsToEntities(data);
    
        /** [6] */
        // await this.connection.applyMutation({
        //   type: 'full',
        //   entities: entities.map(entity => ({
        //     entity,
        //     locationKey: `frobs-provider:${this.env}`,
        //   })),
        // });
      }
  }