# Tyk Backstage Plugin

The Tyk Backstage Plugin imports Tyk API definitions and components into the Backstage catalog directly from Tyk Dashboards.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![npm version](https://badge.fury.io/js/@tyk-technologies%2Fplugin-catalog-backend-module-tyk.svg)](https://www.npmjs.com/package/@tyk-technologies/plugin-catalog-backend-module-tyk)

## Overview

This plugin provides a Backstage entity provider that automatically discovers and imports API definitions from your Tyk Dashboard into the Backstage software catalog. It supports both scheduled synchronization and real-time webhook-based updates.

## Documentation

- **[Installation & Configuration Guide](plugins/catalog-backend-module-tyk/README.md)** - Complete setup instructions
- **[Contributing Guide](CONTRIBUTING.md)** - Development environment and contribution guidelines
- **[Code of Conduct](CODE_OF_CONDUCT.md)** - Community guidelines
- **[Security Policy](SECURITY.md)** - How to report security vulnerabilities

## Quick Start

Install the plugin in your Backstage backend:

```bash
yarn --cwd packages/backend add @tyk-technologies/plugin-catalog-backend-module-tyk
```

Add the plugin to your Backstage backend (`packages/backend/src/index.ts`):

```typescript
backend.add(import('@tyk-technologies/plugin-catalog-backend-module-tyk/alpha'));
```

Configure the plugin in your `app-config.yaml`:

```yaml
tyk:
  globalOptions:
    scheduler:
      enabled: true
      frequency: 5
  dashboards:
    - host: http://localhost:3000
      token: ${TYKDASHBOARDAPITOKEN}
      name: development
      defaults:
        owner: group:default/guests
        system: system:default/tyk
        lifecycle: development
```

See the [full documentation](plugins/catalog-backend-module-tyk/README.md) for detailed configuration options.

## Features

- ✅ Automatic discovery of Tyk API definitions
- ✅ Imports APIs, Dashboards, and Gateway components
- ✅ Scheduled synchronization
- ✅ Real-time webhook-based updates
- ✅ Multi-dashboard support
- ✅ Configurable metadata and relationships
- ✅ Support for Tyk categories as Backstage tags
- ✅ Custom labels and annotations

## Support

- **Issues**: [GitHub Issues](https://github.com/TykTechnologies/backstage-plugin-tyk/issues)
- **Discussions**: [GitHub Discussions](https://github.com/TykTechnologies/backstage-plugin-tyk/discussions)
- **Tyk Community**: [Tyk Community Forum](https://community.tyk.io/)

## License

This project is licensed under the GNU Affero General Public License v3.0 - see the [LICENSE](LICENSE) file for details.
