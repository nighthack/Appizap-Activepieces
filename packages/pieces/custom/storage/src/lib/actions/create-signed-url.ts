import { createAction, Property } from '@activepieces/pieces-framework';
import { createClient } from '@supabase/supabase-js';

export const createSignedUrl = createAction({
  name: 'create_signed_url',
  displayName: 'Create Signed URL',
  description: 'Generate a signed URL for a file in Supabase Storage',
  props: {
    bucketId: Property.Dropdown({
      displayName: 'Bucket Name or ID',
      required: true,
      refreshers: [],
      options: async () => {
        const supabaseUrl = process.env['AP_SUPABASE_GATEWAY'];
        const supabaseKey = process.env['AP_SUPABASE_API_KEY'];

        if (!supabaseUrl || !supabaseKey) {
          throw new Error('Supabase Gateway URL or API Key not configured.');
        }

        const client = createClient(supabaseUrl, supabaseKey, {
          global: {
            fetch: fetch as any,
          },
        });

        const result = await client.storage.listBuckets();

        if (result.error) {
          throw new Error(`Failed to fetch buckets: ${result.error.message}`);
        }

        return {
          options: result.data.map(bucket => ({
            label: bucket.name.split('_')[1] || bucket.name,
            value: bucket.name,
          })),
        };
      },
    }),
    filePath: Property.ShortText({
      displayName: 'File Name',
      required: true,
    }),
  },

  async run(context) {
    const { bucketId, filePath } = context.propsValue;

    const supabaseUrl = process.env['AP_SUPABASE_GATEWAY'];
    const supabaseKey = process.env['AP_SUPABASE_API_KEY'];

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase Gateway URL or API Key not configured.');
    }

    const client = createClient(supabaseUrl, supabaseKey, {
      global: {
        fetch: fetch as any,
      },
    });

    const expiresIn = 60 * 5; // 5 minutes
    const response = await client.storage.from(bucketId).createSignedUrl(filePath, expiresIn);

    if (response.error) {
      throw new Error(`Failed to generate signed URL: ${response.error.message}`);
    }

    return {
      signedUrl: response.data.signedUrl,
      path: filePath,
    };
  },
});
