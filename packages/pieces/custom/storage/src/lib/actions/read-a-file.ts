import { createAction, Property } from '@activepieces/pieces-framework';
import { createClient } from '@supabase/supabase-js';
import { getUUID, getBuckets } from './utils';

export const readAFile = createAction({
  name: 'read_a_file',
  displayName: 'Read a File',
  description: 'Reads a file from a bucket in Supabase storage',
  props: {
    bucketId: Property.Dropdown({
      displayName: 'Bucket Name or ID',
      required: true,
      refreshers: [],
      options: async (propsValue) => {
        const supabaseUrl = process.env['AP_SUPABASE_GATEWAY'];
        const supabaseKey = process.env['AP_SUPABASE_API_KEY'];

        if (!supabaseUrl || !supabaseKey) {
          throw new Error('Supabase Gateway URL or API Key not configured.');
        }

        const auth = propsValue['auth'] as { orgId: string };
        if (!auth?.orgId) {
          return {
            options: [],
            disabled: true,
            placeholder: 'Invalid Org ID',
          };
        }

        const uuid = await getUUID(auth.orgId);

        const buckets = await getBuckets(uuid);

return {
  options: buckets.map(bucket => ({
    label: bucket.name.split('_').pop() || bucket.name,
    value: bucket.name,
  })),
        };
      },
    }),
    filePath: Property.ShortText({
      displayName: 'File Name',
      required: true,
    }),
    dataType: Property.StaticDropdown({
      displayName: 'Data Type',
      required: true,
      options: {
        options: [
          { label: 'Base64', value: 'base64' },
          { label: 'Text (UTF-8)', value: 'utf8' },
        ],
      },
    }),
  },

  async run(context) {
    const { bucketId, filePath, dataType } = context.propsValue;

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

    const response = await client.storage.from(bucketId).download(filePath);
    if (response.error) {
      throw new Error(`Failed to download file: ${response.error.message}`);
    }

    const buffer = await response.data.arrayBuffer();
    const result =
      dataType === 'base64'
        ? Buffer.from(buffer).toString('base64')
        : Buffer.from(buffer).toString('utf8');

    return {
      data: result,
      contentType: response.data.type,
    };
  },
});
