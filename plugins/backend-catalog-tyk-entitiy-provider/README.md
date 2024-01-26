Welcome to the Tyk Backstage Entity Provider


### Sequence Diagrams

#### Entity provider initialisation

How the Backstage catalog initialises Tyk entity providers

```mermaid
sequenceDiagram
    participant ca as Catalog
    participant co as Backstage Configuration
    participant ep as Tyk Entity Provider
    participant td as Tyk Dashboard
    ca->>co: Read entity provider configuration
    co-->>ca: Entity provider configuration
    loop Create each entity provider defined in configuration
        ca->>ep: Entity provider configuration
        ep-->>ca: Entity provider
        ca->>ca: Add entity provider to processing engine
    end
    loop Initialise each entity provider
        ca->>ep: Scheduler and router
        ep->>ep: Setup schedule and routes
        ep->>td: Get Tyk data
        Note over ep: Initial synchronisation
        td-->>ep: Tyk data
        ep->>ep: Convert Tyk data into entities
        ep-)ca: Tyk entities
    end
```

#### Data Import Process

How the Tyk entity provider imports data from a Tyk dashboard into the Backstage catalog

```mermaid
sequenceDiagram
    participant ep as Tyk Entity Provider
    participant td as Tyk Dashboard
    participant ca as Catalog
    ep->>ep: Generate dashboard entity based on provided config
    ep->>td: Get API data
    td-->>ep: API data
    loop Convert APIs into entities
        ep->>ep: Convert API data into entity
    end
    ep->>td: Get system data
    td-->>ep: System data
    loop Process gateways found in defined in system data
        ep->>td: Get gateway data
        td-->>ep: Gateway data
        ep->>ep: Convert gateway data into entity
    end
    ep-->>ep: Generate relationships between API and gateway entities using tags
    ep-)ca: Tyk entities
```

#### Operation of Scheduler

How the Backstage scheduler triggers the Tyk entity provider

```mermaid
sequenceDiagram
    participant ts as Task Scheduler
    participant ep as Entity Provider
    participant td as Tyk Dashboard
    participant ca as Catalog
    ts->>ts: Interval event occurs, based on interval 
    ts-)ep: Trigger synchronisation
    ep->>td: Get Tyk data
    td-->>ep: Tyk data
    ep->>ep: Convert Tyk data into entities
    ep-)ca: Tyk entities
```

#### Operation of Router

How the Backstage router triggers the Tyk entity provider

```mermaid
sequenceDiagram
    participant td as Tyk Dashboard
    participant ro as Router
    participant ep as Entity Provider
    participant ca as Catalog
    td->>ro: Event payload, triggered by data change in dashboard
    ro-)ep: Trigger synchronisation
    ep->>td: Get Tyk data
    td-->>ep: Tyk data
    ep->>ep: Convert Tyk data into entities
    ep-)ca: Tyk entities
    ro-->>td: Status code
```
