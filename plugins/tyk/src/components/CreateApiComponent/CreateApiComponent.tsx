import React from 'react';
import {Table, TableColumn, Progress, ResponseErrorPanel, LinkButton} from '@backstage/core-components';
// import {fetchApiRef, useApi} from '@backstage/core-plugin-api';
import useAsync from 'react-use/lib/useAsync';
import {Button, Card, TextField} from "@material-ui/core";
import { useApi, configApiRef } from '@backstage/core-plugin-api';

export const CreateApiComponent = () => (
  <Card>
    <h1>Create API</h1>
    <form>
      <TextField id="api-name" label="API Name" variant="standard" />
      <Button id="create-api" variant="contained" onClick={() => {
      alert('clicked');}}>Create</Button>
    </form>
  </Card>
);
