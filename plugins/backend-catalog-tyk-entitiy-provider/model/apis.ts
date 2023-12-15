import {z} from 'zod';

const APISchema = z.object({
  api_definition: z.object({
    api_id: z.string(),
    name: z.string(),
    active: z.boolean(),
    use_keyless: z.boolean().optional(),
    use_oauth2: z.boolean().optional(),
    use_standard_auth: z.boolean().optional(),
    use_mutual_tls_auth: z.boolean().optional(),
    use_basic_auth: z.boolean().optional(),
    use_jwt: z.boolean().optional(),
    graphql: z.object({
      enabled: z.boolean(),
      schema: z.string(),
    }).optional(),
  }),
  oas: z.any().optional(),
});

export const ApiEventSchema = z.object({
  event: z.string(),
  data: APISchema
});

export const APIListResponseSchema = z.object({
  apis: z.array(APISchema),
});

type APIListResponse = z.infer<typeof APIListResponseSchema>;
type API = z.infer<typeof APISchema>;
type ApiEvent = z.infer<typeof ApiEventSchema>;

export type { API, ApiEvent, APIListResponse};
