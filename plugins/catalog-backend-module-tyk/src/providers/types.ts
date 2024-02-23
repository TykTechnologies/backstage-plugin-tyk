import * as z from 'zod';

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
  
export const TykGlobalOptionsConfigSchema = z.object({
router: z.object({
    enabled: z.boolean(),
}),
scheduler: z.object({
    enabled: z.boolean(),
    frequency: z.number().optional(),
}),
importCategoriesAsTags: z.boolean().optional(),
})

export const TykConfigSchema = z.object({
globalOptions: TykGlobalOptionsConfigSchema,
dashboards: z.array(TykDashboardConfigSchema),
});  

export type TykDashboardConfig = z.infer<typeof TykDashboardConfigSchema>;
export type TykConfig = z.infer<typeof TykConfigSchema>;
export type TykGlobalOptionsConfig = z.infer<typeof TykGlobalOptionsConfigSchema>;
