import React from 'react';
import { createDevApp } from '@backstage/dev-utils';
import { tykPlugin, TykPage } from '../src/plugin';

createDevApp()
  .registerPlugin(tykPlugin)
  .addPage({
    element: <TykPage />,
    title: 'Root Page',
    path: '/tyk'
  })
  .render();
