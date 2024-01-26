Welcome to the Tyk Backstage Entity Provider


### Sequence Diagrams

#### Entity provider initialisation

Initialisation of the entity provider by the Backstage catalog

```mermaid
sequenceDiagram
    participant ca as Catalog
    participant co as Backstage Configuration
    participant ep as Tyk Entity Provider
    participant td as Tyk Dashboard
    ca->>co: Read entity provider configuration
    co-->>ca: Entity provider configuration
    loop Each entity provider configuration
        ca->>ep: Create entity provider using configuration
        ep-->>ca: Entity provider
        ca->>ca: Add entity provider to processing engine
    end
    loop Each entity provider
        ca->>ep: Initialise entity provider scheduler and routes
        ep->>td: Get Tyk data
        td-->>ep: Tyk data
        ep->>ep: Convert Tyk data into entities
        ep-)ca: Tyk entities
    end
```

#### Synchronisation Process


#### Operation of Scheduler

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
