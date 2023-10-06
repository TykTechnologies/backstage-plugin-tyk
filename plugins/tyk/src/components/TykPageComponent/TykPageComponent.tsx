import React from 'react';
import { Typography, Grid } from '@material-ui/core';
import {
  InfoCard,
  Header,
  Page,
  Content,
  ContentHeader,
  HeaderLabel,
  SupportButton,
} from '@backstage/core-components';
import { APIListComponent } from '../APIListComponent';

export const TykPageComponent = () => (
  <Page themeId="tool">
    <Header title="Tyk API Manager" subtitle="API Management for Backstage">
      <HeaderLabel label="Owner" value="Team Research" />
      <HeaderLabel label="Lifecycle" value="Alpha" />
    </Header>
    <Content>
      <Grid container spacing={3} direction="column">
        <Grid item>
          <APIListComponent />
        </Grid>
      </Grid>
    </Content>
  </Page>
);
