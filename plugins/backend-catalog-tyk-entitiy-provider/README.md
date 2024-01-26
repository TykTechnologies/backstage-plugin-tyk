Welcome to the Tyk Backstage Entity Provider


### Sequence Diagrams

Initialisation of the entity provider by the Backstage catalog

```mermaid
sequenceDiagram
    
    Backstage Catalog->>Backstage Configuration: Read entity provider configuration
    Backstage Configuration->>Backstage Catalog: Entity provider configuration
    loop Each entity provider configuration
        Backstage Catalog->>Tyk Entity Provider: Create entity provider using configuration
        Tyk Entity Provider->>Backstage Catalog: Entity provider
        Backstage Catalog->>Backstage Catalog: Add entity provider to processing engine
    end
    loop Each entity provider
        Backstage Catalog->>Tyk Entity Provider: Initialise entity provider scheduler and routes
        Tyk Entity Provider->>Tyk Dashboard: Get Tyk data
        Tyk Dashboard->>Tyk Entity Provider: Tyk data
        Tyk Entity Provider->>Tyk Entity Provider: Convert Tyk data into entities
        Tyk Entity Provider->>Backstage Catalog: Tyk entities
    end
```

