import React from 'react';
import { ExampleComponent } from './ExampleComponent';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { screen } from '@testing-library/react';
import {
  setupRequestMockHandlers,
  renderInTestApp,
  TestApiProvider,
} from '@backstage/test-utils';
import { fetchApiRef } from '@backstage/core-plugin-api';
import fetch from 'cross-fetch';

describe('ExampleComponent', () => {
  const server = setupServer();
  // Enable sane handlers for network requests
  setupRequestMockHandlers(server);

  // setup mock response
  beforeEach(() => {
    server.use(
      rest.get('https://randomuser.me/*', (_, res, ctx) =>
        res(ctx.status(200), ctx.json({ results: [] })),
      ),
    );
  });

  it('should render', async () => {
    await renderInTestApp(
      <TestApiProvider apis={[[fetchApiRef, { fetch }]]}>
        <ExampleComponent />
      </TestApiProvider>,
    );
    expect(screen.getByText('Tyk API Manager')).toBeInTheDocument();
  });
});
