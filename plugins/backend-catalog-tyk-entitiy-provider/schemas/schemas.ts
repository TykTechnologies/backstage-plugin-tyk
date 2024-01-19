import * as z from 'zod';

export const APISchema = z.object({
  api_definition: z.object({
    api_id: z.string(),
    name: z.string(),
    active: z.boolean(),
    tags: z.array(z.string()),
    config_data: z.object({
      backstage: z.object({
        owner: z.string().optional(),
        lifecycle: z.string().optional(),
        system: z.string().optional(),
        labels: z.array(
          z.object({
            key: z.string(),
            value: z.string(),
          })
        ).optional()
      }).optional(),
    }).optional(),
    use_keyless: z.boolean().optional(),
    use_oauth2: z.boolean().optional(),
    use_standard_auth: z.boolean().optional(),
    use_mutual_tls_auth: z.boolean().optional(),
    use_basic_auth: z.boolean().optional(),
    use_jwt: z.boolean().optional(),
    version_data: z.object({
      not_versioned: z.boolean().optional(),
      versions: z.object({}).optional(),
    }).optional(),
    proxy: z.object({
      listen_path: z.string().optional(),
      target_url: z.string().optional(),
      strip_listen_path: z.boolean().optional(),
    }).optional(),
    graphql: z.object({
      enabled: z.boolean(),
      schema: z.string(),
    }).optional(),
  }),
  oas: z.any().optional(),
  user_group_owners: z.array(z.string()).optional(),
  user_owners: z.array(z.string()).optional(),
});

export const ApiEventSchema = z.object({
  event: z.string(),
  data: APISchema
});

export const APIListResponseSchema = z.object({
  apis: z.array(APISchema),
});

export const TykDashboardConfigSchema = z.object({
  host: z.string(),
  token: z.string(),
  name: z.string(),
  defaults: z.object({
    owner: z.string().optional(),
    system: z.string().optional(),
    lifecycle: z.string().optional(),
  }).optional(),
});

export const TykConfigSchema = z.object({
  router: z.object({
    enabled: z.boolean(),
  }),
  scheduler: z.object({
    enabled: z.boolean(),
    frequency: z.number().optional(),
  }),
  importCategoriesAsTags: z.boolean().optional(),
  dashboards: z.array(TykDashboardConfigSchema),
});

export const SystemNodesSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      hostname: z.string(),
    })
  ),
  active_node_count: z.number(),
  nodes_available: z.number(),
  nodes_remaining: z.number(),
  valid_until: z.number(),
});

export const DashboardSystemNodesResponseSchema = z.object({
  data: SystemNodesSchema,
});

export const GatewayResponseSchema = z.object({
  data: z.object({
    db_app_conf_options: z.object({
      node_is_segmented: z.boolean(),
      tags: z.array(z.string()),
    }),
  }),
});

export type enrichedGateway = {
  id: string
  hostname: string
  segmented: boolean
  tags: string[]
};

export type APIListResponse = z.infer<typeof APIListResponseSchema>;
export type API = z.infer<typeof APISchema>;
export type ApiEvent = z.infer<typeof ApiEventSchema>;
export type TykDashboardConfig = z.infer<typeof TykDashboardConfigSchema>;
export type TykConfig = z.infer<typeof TykConfigSchema>;
export type TykDashboardSystemNodesResponse = z.infer<typeof DashboardSystemNodesResponseSchema>;
export type GatewayResponse = z.infer<typeof GatewayResponseSchema>;
