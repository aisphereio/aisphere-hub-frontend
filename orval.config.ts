import { defineConfig } from 'orval';

export default defineConfig({
  hub: {
    input: {
      target: './openapi/aisphere-hub.swagger.json',
      // The hub authz lookup RPCs use proto map fields as query parameters;
      // protoc-gen-openapiv2 emits these as `type: object` query params, which
      // orval's Swagger 2.0 schema validator rejects (maps as query strings are
      // a known openapiv2 limitation). Validation is disabled so generation can
      // proceed; the generated functions for those params serialize correctly.
      unsafeDisableValidation: true,
    },
    output: {
      target: './src/lib/api/generated/hub.ts',
      schemas: './src/lib/api/generated/model',
      client: 'fetch',
      mode: 'tags-split',
      clean: true,
      urlEncodeParameters: true,
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
        mutator: {
          path: './src/lib/api/hub-fetch.ts',
          name: 'hubFetch',
        },
      },
    },
  },
});
