# Installation / Configuration

The project is currently in alpha, so is not yet properly packaged. This means that to run the plugin, you must clone this full backstage repo that includes the plugin code.

Prereqs:
- A Tyk installation, with knowledge of the Dashboard API credentials
- General Backstage prereqs as per https://backstage.io/docs/getting-started/#prerequisites

Getting started:
1. Clone this repo
2. Run `yarn install`
3. Update the `tyk.dashboards` section of the `app-config.yaml`, setting the values of `host` and `token` to those of your Tyk Dashboard host url and API token.
4. Run `yarn dev` 

# Using router sync

Router sync is enabled in the default config, but this only sets up the listen paths in Backstage. For it to function you need to configure your Tyk installation to fire a webhook when there is an API definition change.

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
1. The `webhook` URL resolves to the Backstage backend deployment from the Tyk Dashboard.
2. The `webhook` URL path uses the dashboard name specified in the `app-config.yaml` - the default value `development`, is used in the example above.
