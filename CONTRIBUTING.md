This guide explains how to set up your development environment and contribute to the project.

For details on how the entity provider works, refer to the [Entity Provider README](plugins/catalog-backend-module-tyk/README.md).

# Development Environment Setup

Prerequisites:

1. **Tyk Installation**: Ensure you have access to a Tyk installation, including the Tyk Dashboard URL and API access token.
2. **Backstage Requirements**: Follow the general prerequisites listed on the [Backstage documentation](https://backstage.io/docs/getting-started/#prerequisites).
3. **Access to the Tyk Backstage Entity Provider Repository**: [GitHub Repo](https://github.com/TykTechnologies/backstage-tyk-entity-provider).
4. **Node version**: Ensure a compatible version of Node is available, as per the `engines.node` setting in the [package.json](package.json) file.

Once these prerequisites are in place, proceed with setting up the Backstage development environment.

Steps to Set Up:

1. Clone the repository:
```sh
git clone https://github.com/TykTechnologies/backstage-tyk-entity-provider
```

2. Navigate to the cloned directory:
```sh
cd backstage-tyk-entity-provider
```

3. Install Backstage packages:
```sh
yarn install
```

4. Create an `app-config.local.yaml`, then add just the Tyk entity provider config to it. Set the Tyk Dashboard host URL and API token using the detail for your Tyk environment. Update the `tyk.dashboards[].host` and `tyk.dashboards[].token` fields with your actual values:

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
Your development environment is now set up.

## Running the Development Environment

To start the Backstage environment, run:

```sh
yarn dev
```

This will launch both the frontend and backend, and you'll see logs for both. If everything is working correctly, you'll see logs like these for the backend:

```log
[1] 2024-09-16T10:13:21.618Z catalog info Tyk entity provider initialized: tyk-entity-provider-development type=plugin
[1] 2024-09-16T10:13:23.077Z catalog info Importing 52 Tyk entities type=plugin entityProvider=tyk-entity-provider-development
```

## Debugging the Development Environment

### VS Code

Set the VS Code *Auto Attach* feature to *With Flag* - [see VS Code docs](https://code.visualstudio.com/docs/nodejs/nodejs-debugging#_auto-attach). The debugger will then automatically attach to processes launched from the VS Code terminal that include the `--inspect` flag.

To debug the entity provider, launch the Backstage backend with the `--inspect` flag:

```shell
yarn start-backend --inspect
```

You can run the Backstage frontend separately, in a different terminal.

## Using router sync

Router sync is enabled by default, but it only sets up the listen paths in the Backstage entity provider. To ensure that your Tyk Dashboard triggers the sync when an API definition changes, configure a webhook in your Tyk organization.

Update the event options in your Tyk organization’s JSON object through the Dashboard Admin API. Add an `api_event` object like this:

```json
{
    "api_event": {
        "webhook": "http://host.docker.internal:7007/api/catalog/tyk/development/sync",
        "email": "",
        "redis": false
    }
}
```

Ensure that:
1. The `webhook` URL can reach the Backstage backend from the Tyk Dashboard.
2. The URL path matches the dashboard name in the app-config.yaml (e.g., `development`).

Once configured, API changes in the Dashboard will trigger a sync in the entity provider, as seen in the logs:

```log
[1] 2024-09-16T10:27:40.015Z catalog info Importing 53 Tyk entities type=plugin entityProvider=tyk-entity-provider-development
[1] 2024-09-16T10:27:40.025Z backstage info ::ffff:127.0.0.1 - - [16/Sep/2024:10:27:40 +0000] "POST /api/catalog/tyk/development/sync HTTP/1.1" 200 - "-" "Tyk-Dash-Hookshot" type=incomingRequest
```

# Source Location

The entity provider source code is located in the `plugins/catalog-backend-module-tyk` directory.

# Debugging

If you're using Visual Studio Code, you can debug the Backstage backend by running it with the `--inspect` flag from the VSCode terminal window:

```sh
yarn start-backend --inspect
```

Start the frontend in a separate terminal window:

```sh
yarn start
```

You now have both the backend and frontend running, and can start to debug the application.

# Publishing

To publish a new version of the Backstage entity provider to NPM:

Prerequisites:
- Access to the Tyk Backstage entity provider NPM package: [NPM Package](https://npmjs.com/package/@tyk-technologies/plugin-catalog-backend-module-tyk)

Publishing Steps:
1. Navigate to the plugin directory:
```sh
cd plugins/catalog-backend-module-tyk
```

2. Increment the `version` number in the [package manifest](plugins/catalog-backend-module-tyk/package.json).

3. Build the package:
```sh
yarn run build
```

4. Publish to NPM:
```sh
npm publish
```

You'll need to authenticate during the publish process as the package is private. Follow the instructions from the NPM CLI.

After publishing, the new version will be available on the [NPM registry](https://www.npmjs.com/package/@tyk-technologies/plugin-catalog-backend-module-tyk?activeTab=versions).
