import React from 'react';
import { Table, TableColumn, Progress, ResponseErrorPanel, LinkButton } from '@backstage/core-components';
// import {fetchApiRef, useApi} from '@backstage/core-plugin-api';
import useAsync from 'react-use/lib/useAsync';
import { Button, Card, TextField } from "@material-ui/core";
import { useApi, configApiRef } from '@backstage/core-plugin-api';

export const CreateApiComponent = () => {
  const handleClick = async () => {
    const a = 1;
    // const response = await fetch('http://localhost:3000/api/apis', { headers: { Authorization: '7304f7eb99984e9f6837d3f8bbc7e252' } })

    // const data = await response.json()
    // const apis = data.apis

    // apis.forEach((api: { api_definition: { api_id: any; name: any; }; }) => {
    //   console.log('a');
    // });
    alert('Your click worked!');
  };

  return (
    <Card>
      <h1>Create API</h1>
      <form>
        <TextField id="api-name" label="API Name" variant="standard" />
        <Button id="create-api" variant="contained" onClick={handleClick}>Create</Button>
      </form>
    </Card>
  );
}