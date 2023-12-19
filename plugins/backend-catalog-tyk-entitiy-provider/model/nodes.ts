import {z} from 'zod';

// let SampleSystemNodeSchemaData = {
//   "data": {
//     "nodes": [
//       {
//         "id": "073d8b83-f392-4573-6688-dac8ae8cf7cc",
//         "hostname": "MacBook-Pro.local"
//       }
//     ],
//     "active_node_count": 1,
//     "nodes_available": 10,
//     "nodes_remaining": 9,
//     "valid_until": 1703807999
//   },
//   "pages": 1
// };

const NodeSchema = z.object({
  id: z.string(),
  hostname: z.string(),
});

const SystemNodeSchema = z.object({
  data: z.object({
    nodes: z.array(NodeSchema),
    active_node_count: z.number(),
    nodes_available: z.number(),
    nodes_remaining: z.number(),
    valid_until: z.number(),
  }),
  pages: z.number(),
});

type SystemNode = z.infer<typeof SystemNodeSchema>;

const NodeDetailSchema = z.object({
  data: z.object({
    db_app_conf_options: z.object({
      // connection_string: z.string(),
      node_is_segmented: z.boolean(),
      tags: z.array(z.string()),
    }),
  })
});

type NodeDetail = z.infer<typeof NodeDetailSchema>;

export {
  SystemNodeSchema,
  NodeDetailSchema,
};

export type {SystemNode, NodeDetail};
