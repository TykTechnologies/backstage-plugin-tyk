import React from 'react';
import {Table, TableColumn, Progress, ResponseErrorPanel, LinkButton} from '@backstage/core-components';
// import {fetchApiRef, useApi} from '@backstage/core-plugin-api';
import useAsync from 'react-use/lib/useAsync';
import {Button} from "@material-ui/core";
import { useApi, configApiRef } from '@backstage/core-plugin-api';

type APIDefinition = {
  id: string;
  name: string;
  active: boolean;
  endpoint: string;
  use_keyless: boolean;
}

type DenseTableProps = {
  apiDefinitions: APIDefinition[];
};

export const DenseTable = ({apiDefinitions}: DenseTableProps) => {
  // const classes = useStyles();

  const columns: TableColumn[] = [
    {title: 'ID', field: 'id'},
    {title: 'Name', field: 'name'},
    {title: 'Endpoint', field: 'endpoint'},
    {title: 'Active', field: 'active'},
    {title: 'Actions', field: 'actions'},
  ];

  const handleKeyRequest = async (apiDefinition) => {
    // eslint-disable-next-line no-console
    console.log("key request for API", apiDefinition);

    const keyRequest = {
      "last_check": 0,
      "allowance": -1,
      "rate": 1000,
      "per": 60,
      "expires": 0,
      "quota_max": -1,
      "quota_renews": 1597053088,
      "quota_remaining": -1,
      "quota_renewal_rate": 2520000,
      access_rights: {
        [apiDefinition.id]: {
          "api_id": apiDefinition.id,
          "api_name": apiDefinition.name,
          "versions": [
            "Default"
          ]
        }
      }
    };

    const response = await fetch('http://localhost:8080/dashboard/keys', {
      method: 'POST',
      body: JSON.stringify(keyRequest),
    });

    const data = await response.json();

    // eslint-disable-next-line no-alert
    alert(data.key_id);

    // eslint-disable-next-line no-console
    console.log("key request response", data);
  }

  const data = apiDefinitions.map(apiDefinition => {
    return {
      id: apiDefinition.id,
      name: apiDefinition.name,
      active: apiDefinition.active,
      endpoint: <a target="_blank" href={apiDefinition.endpoint}>{apiDefinition.endpoint}</a>,
      actions: <Button onClick={() => handleKeyRequest(apiDefinition)}>Request Key</Button>
    };
  });

  return (
    <Table
      title="API Definition List"
      options={{search: false, paging: false}}
      columns={columns}
      data={data}
    />
  );
};

export const APIListComponent = () => {
  // const {fetch} = useApi(fetchApiRef);
  const config = useApi(configApiRef);
  const backendUrl = config.getString('backend.baseUrl');
  
  const {value, loading, error} = useAsync(async (): Promise<APIDefinition[]> => {
    const response = await fetch(backendUrl + '/api/proxy/tyk/apis', {});

    const data = await response.json();
    const apis = data.apis;

    const formatted = [];

    apis.forEach(api => {
      formatted.push({
        id: api.api_definition.api_id,
        name: api.api_definition.name,
        active: api.api_definition.active,
        use_keyless: api.api_definition.use_keyless,
        endpoint: `http://localhost:8080${api.api_definition.proxy.listen_path}`,
      });
    });

    return formatted;
  }, []);

  if (loading) {
    return <Progress/>;
  } else if (error) {
    return <ResponseErrorPanel error={error}/>;
  }

  return <DenseTable apiDefinitions={value || []}/>;
};
