import React from 'react';
import { Grid } from '@material-ui/core';
import {
  Header,
  Page,
  Content,
  HeaderLabel,
} from '@backstage/core-components';
import { APIListComponent } from '../APIListComponent';
import { CreateApiComponent } from '../CreateApiComponent';

export const TykPageComponent = () => (
  <Page themeId="tool">
    <Header title="Tyk API Manager" subtitle="API Management for Backstage">
      <HeaderLabel label="Owner" value="Team Research" />
      <HeaderLabel label="Lifecycle" value="Alpha" />
    </Header>
    <Content>
      <Grid container spacing={2}>
        <Grid item xs={9}>
          <APIListComponent />
        </Grid>
        <Grid item xs={3}>
          <CreateApiComponent />
        </Grid>
      </Grid>
    </Content>
  </Page>
);
