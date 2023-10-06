import { createPlugin, createRoutableExtension } from '@backstage/core-plugin-api';

import { rootRouteRef } from './routes';

export const tykPlugin = createPlugin({
  id: 'tyk',
  routes: {
    root: rootRouteRef,
  },
});

export const TykPage = tykPlugin.provide(
  createRoutableExtension({
    name: 'TykPage',
    component: () =>
      import('./components/TykPageComponent').then(m => m.TykPageComponent),
    mountPoint: rootRouteRef,
  }),
);
