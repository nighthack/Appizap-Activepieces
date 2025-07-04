import { createAction, Property } from '@activepieces/pieces-framework';
import { createClient } from '@supabase/supabase-js';

export const deleteFile = createAction({
  name: 'delete_file',
  displayName: 'Delete File',
  description: 'Deletes a file from a Supabase storage bucket',
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

    const response = await client.storage.from(bucketId).remove([filePath]);
    if (response.error) {
      throw new Error(`Failed to delete file: ${response.error.message}`);
    }

    return {
      success: true,
      message: `File '${filePath}' deleted successfully`,
    };
  },
});
