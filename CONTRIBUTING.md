This is the developer guide, which explains how to set up a development environment and contribute to the project.

# Development Environment Setup

Prerequisites:
1. A Tyk installation, that you can connect to from your development environment, with knowledge of the Tyk dashboard URL and API access token
2. General Backstage prereqs as per https://backstage.io/docs/getting-started/#prerequisites
3. Access to the Tyk Backstage entity provider Github repo https://github.com/TykTechnologies/backstage-tyk-entity-provider

Once you have the prerequisites you can set up the Backstage development environment.

Development environment setup:
1. Clone this repo - `git clone https://github.com/TykTechnologies/backstage-tyk-entity-provider`
2. Change to the cloned directory - `cd backstage-tyk-entity-provider`
3. Install the backstage packages with yarn - `yarn install`
4. Update the `tyk.dashboards` section of the `app-config.yaml`, setting the values of `host` and `token` to those of your Tyk Dashboard host url and API token

For example, replace the values `tyk.dashboards.host` and `tyk.dashboards.token` with your values:
```yaml
tyk:
  globalOptions:
    router:
      enabled: true
    scheduler:
      enabled: true
      frequency: 5
    importCategoriesAsTags: true
  dashboards:
    - host: http://my-tyk-dashboard-url:3000
      token: my-tyk-dashboard-api-token
      name: development
      defaults:
        owner: group:default/guests
        system: system:default/tyk
        lifecycle: development
```

To test if it is working, use yarn to run Backstage:

```
yarn dev
```

This will start Backstage's frontend and backend, and show the application log for both. If it's working correctly, you should see some messages from the `catalog` that refer to the entity provider:

```log
[1] 2024-09-16T10:13:21.618Z catalog info Tyk entity provider initialized: tyk-entity-provider-development type=plugin
[1] 2024-09-16T10:13:23.077Z catalog info Importing 52 Tyk entities type=plugin entityProvider=tyk-entity-provider-development
```

## Using router sync

Router sync is enabled in the default config, but this only sets up the listen paths in the Backstage entity provider. In order to have the Tyk dashboard call the entity provider listen path, you need to configure your Tyk dashboard to fire a webhook when there is an API definition change.

To do this, update your Tyk organisation JSON object via the Dashboard Admin API. In your organisation's `event_options` section, add an `api_event` object similar to this:

```json
{
    "api_event": {
        "webhook": "http://host.docker.internal:7007/api/catalog/tyk/development/sync",
        "email": "",
        "redis": false
    }
}
```

Make sure that:
1. The `webhook` URL resolves to the Backstage backend deployment from the Tyk Dashboard
2. The `webhook` URL path uses the dashboard name specified in the `app-config.yaml` - the default value `development`, is used in the example above

Once this is correctly configured, you should see that changes to API data in the Dashboard result in immediate synchronisation by the Backstage entity provider. This can be seen in the entity provider logs:

```log
[1] 2024-09-16T10:27:40.015Z catalog info Importing 53 Tyk entities type=plugin entityProvider=tyk-entity-provider-development
[1] 2024-09-16T10:27:40.025Z backstage info ::ffff:127.0.0.1 - - [16/Sep/2024:10:27:40 +0000] "POST /api/catalog/tyk/development/sync HTTP/1.1" 200 - "-" "Tyk-Dash-Hookshot" type=incomingRequest
```

This shows both the entity provider synchronisation confirmation and also the webhook call being received by the entity provider sync endpoint from the Tyk dashboard.

# Debugging



# Publishing

4. Access to the Tyk Backstage entity provider NPM package https://npmjs.com/package/@tyk-technologies/plugin-catalog-backend-module-tyk





# Publishing changes

