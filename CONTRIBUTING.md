# Contributing Guide

This guide explains how to set up your development environment and contribute to the project.

For details on how the entity provider works, refer to the [Entity Provider README](plugins/catalog-backend-module-tyk/README.md).

## Contributor License Agreement

We'd love to accept your patches! Before we can take them, we have to jump a couple of legal hurdles.

**The [Tyk Contributor License Agreement](Tyk-Contributor-License-Agreement.pdf) must be signed by all contributors.** You will be automatically asked to sign the CLA once a PR is created.

Once you are CLA'ed, we'll be able to accept your pull requests. For any issues that you face during this process, please create a GitHub issue explaining the problem and we will help get it sorted out.

**NOTE**: Only original source code from you and other people that have signed the CLA can be accepted into the repository. This policy does not apply to vendor.

### CLA Terms Summary

The following terms are used throughout this agreement:

**You** - the person or legal entity including its affiliates asked to accept this agreement. An affiliate is any entity that controls or is controlled by the legal entity, or is under common control with it.

**Project** - is an umbrella term that refers to any and all Tyk Technologies open source projects.

**Contribution** - any type of work that is submitted to a Project, including any modifications or additions to existing work.

**Submitted** - conveyed to a Project via a pull request, commit, issue, or any form of electronic, written, or verbal communication with Tyk Technologies, contributors or maintainers.

#### 1. Grant of Copyright License

Subject to the terms and conditions of this agreement, You grant to the Projects' maintainers, contributors, users and to Tyk Technologies a perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable copyright license to reproduce, prepare derivative works of, publicly display, publicly perform, sublicense, and distribute Your contributions and such derivative works. Except for this license, You reserve all rights, title, and interest in your contributions.

#### 2. Grant of Patent License

Subject to the terms and conditions of this agreement, You grant to the Projects' maintainers, contributors, users and to Tyk Technologies a perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable (except as stated in this section) patent license to make, have made, use, offer to sell, sell, import, and otherwise transfer your contributions, where such license applies only to those patent claims licensable by you that are necessarily infringed by your contribution or by combination of your contribution with the project to which this contribution was submitted.

If any entity institutes patent litigation - including cross-claim or counterclaim in a lawsuit - against You alleging that your contribution or any project it was submitted to constitutes or is responsible for direct or contributory patent infringement, then any patent licenses granted to that entity under this agreement shall terminate as of the date such litigation is filed.

#### 3. Source of Contribution

Your contribution is either your original creation, based upon previous work that, to the best of your knowledge, is covered under an appropriate open source license and you have the right under that license to submit that work with modifications, whether created in whole or in part by you, or you have clearly identified the source of the contribution and any license or other restriction (like related patents, trademarks, and license agreements) of which you are personally aware.

**For the full legal terms, please see the [formal Contributor License Agreement PDF](Tyk-Contributor-License-Agreement.pdf).**

## Development Environment Setup

Prerequisites:

1. **Tyk Installation**: Ensure you have access to a Tyk installation, including the Tyk Dashboard URL and API access token.
2. **Backstage Requirements**: Follow the general prerequisites listed on the [Backstage documentation](https://backstage.io/docs/getting-started/#prerequisites).
3. **Access to the Tyk Backstage Plugin Repository**: [GitHub Repo](https://github.com/TykTechnologies/backstage-plugin-tyk).
4. **Node version**: Ensure a compatible version of Node is available, as per the `engines.node` setting in the [package.json](package.json) file.

Once these prerequisites are in place, proceed with setting up the Backstage development environment.

Steps to Set Up:

1. Clone the repository:
```sh
git clone https://github.com/TykTechnologies/backstage-plugin-tyk
```

2. Navigate to the cloned directory:
```sh
cd backstage-plugin-tyk
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

Update the event options in your Tyk organization's JSON object through the Dashboard Admin API. Add an `api_event` object like this:

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

## Source Location

The entity provider source code is located in the `plugins/catalog-backend-module-tyk` directory.

## Debugging

If you're using Visual Studio Code, you can debug the Backstage backend by running it with the `--inspect` flag from the VSCode terminal window:

```sh
yarn start-backend --inspect
```

Start the frontend in a separate terminal window:

```sh
yarn start
```

You now have both the backend and frontend running, and can start to debug the application.

## Publishing

To publish a new version of the Tyk Backstage Plugin to NPM:

### Prerequisites

- Write access to the [@tyk-technologies](https://www.npmjs.com/org/tyk-technologies) NPM organization
- NPM account authenticated locally (`npm login`)

### Publishing Steps

1. Navigate to the plugin directory:
```sh
cd plugins/catalog-backend-module-tyk
```

2. Increment the `version` number in the [package manifest](plugins/catalog-backend-module-tyk/package.json) following [semantic versioning](https://semver.org/):
   - **Patch** (0.1.13 → 0.1.14): Bug fixes and minor updates
   - **Minor** (0.1.13 → 0.2.0): New features, backward compatible
   - **Major** (0.1.13 → 1.0.0): Breaking changes

3. Update the [CHANGELOG.md](CHANGELOG.md) with the new version and changes

4. Build the package:
```sh
yarn run build
```

5. Verify the package contents:
```sh
npm pack --dry-run
```

6. Publish to NPM:
```sh
npm publish
```

7. Create a git tag for the release:
```sh
git tag -a v0.1.14 -m "Release v0.1.14"
git push origin v0.1.14
```

8. Create a GitHub release with the changelog

After publishing, the new version will be available on the [NPM registry](https://www.npmjs.com/package/@tyk-technologies/plugin-catalog-backend-module-tyk?activeTab=versions).

### Troubleshooting

If you encounter authentication issues:
1. Ensure you're logged in: `npm whoami`
2. If not logged in: `npm login`
3. Verify you have access to the @tyk-technologies organization
