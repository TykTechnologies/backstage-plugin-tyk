import React from 'react';
import { Button, Card, TextField } from "@material-ui/core";
import { useApi, configApiRef } from '@backstage/core-plugin-api';

export const CreateApiComponent = () => {
  const config = useApi(configApiRef);
  const backendUrl = config.getString('backend.baseUrl') + '/api/proxy/tyk/apis';
  const kebabCase: (s: string) => string = (s: string) => {
    return s.replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
  }

  const handleClick = async (event: any) => {
    event.preventDefault();
    console.log(event);
    const apiNameValue = event.target.apiname.value;
    const kebabApiNameValue = kebabCase(apiNameValue);

    try {
      const response = await fetch(backendUrl, {
        method: 'POST',
        body: JSON.stringify({
          api_definition: {
            name: apiNameValue,
            use_keyless: true,
            version_data: {
              not_versioned: true,
              versions: {}
            },
            proxy: {
              listen_path: `/${kebabApiNameValue}/`,
              target_url: 'http://httpbin/',
              strip_listen_path: true
            },
            active: true
          }
        })
      })

      const data = await response.json();
      if (response.status != 200) {
        alert('Error adding API to Tyk - see console');
        console.error(data);
      } else {
        alert('API added to Tyk');
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Card>
      <h1>Create API</h1>
      <form onSubmit={handleClick}>
        <TextField id="apiname" name="apiname" label="API Name" variant="standard" />
        <Button type="submit" id="create-api" variant="contained">Create</Button>
      </form>
    </Card>
  );
}