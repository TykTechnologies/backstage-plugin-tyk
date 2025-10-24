import React from 'react';
import { render, screen } from '@testing-library/react';
import { ExampleFetchComponent } from './ExampleFetchComponent';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { setupRequestMockHandlers, TestApiProvider } from '@backstage/test-utils';
import { fetchApiRef } from '@backstage/core-plugin-api';
import fetch from 'cross-fetch';

describe('ExampleFetchComponent', () => {
  const server = setupServer();
  // Enable sane handlers for network requests
  setupRequestMockHandlers(server);

  // setup mock response
  beforeEach(() => {
    server.use(
      rest.get('https://randomuser.me/*', (_, res, ctx) =>
        res(ctx.status(200), ctx.delay(2000), ctx.json({})),
      ),
    );
  });
  it('should render', async () => {
    await render(
      <TestApiProvider apis={[[fetchApiRef, { fetch }]]}>
        <ExampleFetchComponent />
      </TestApiProvider>,
    );
    expect(await screen.findByTestId('progress')).toBeInTheDocument();
  });
});
