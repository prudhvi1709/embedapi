import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          // Add any additional KV namespaces for testing
          kvNamespaces: ["EMBEDDINGS_KV"],
        },
      },
    },
  },
}); 