import { createAction, Property } from '@activepieces/pieces-framework';
import { createClient } from '@supabase/supabase-js';
import { getUUID, getBuckets } from './utils';

export const uploadFile = createAction({
  name: 'upload_file',
  displayName: 'Upload File',
  description: 'Uploads a file to Supabase Storage',
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
      displayName: 'File Name (with path)',
      description: 'Path inside the bucket to store the file (e.g., folder/myfile.txt)',
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

    contentType: Property.ShortText({
      displayName: 'Content-Type (e.g., text/plain, image/png)',
      required: true,
    }),

    data: Property.LongText({
      displayName: 'Data',
      description: 'The file contents (plain text or Base64)',
      required: true,
    }),

    returnSignedUrl: Property.Checkbox({
      displayName: 'Return Signed URL',
      required: false,
      defaultValue: false,
    }),
  },

  async run(context) {
    const {
      bucketId,
      filePath,
      data,
      dataType,
      contentType,
      returnSignedUrl,
    } = context.propsValue;

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

    const encodedBuffer = Buffer.from(data, dataType as BufferEncoding);

    const uploadRes = await client.storage
      .from(bucketId)
      .upload(filePath, encodedBuffer, {
        contentType,
        upsert: true, // Optional: overwrite if file exists
      });

    if (uploadRes.error) {
      throw new Error(`Failed to upload file: ${uploadRes.error.message}`);
    }

    let signedUrl: string | undefined = undefined;
    if (returnSignedUrl) {
      const expiresIn = 60 * 5; // 5 minutes
      const signedRes = await client.storage.from(bucketId).createSignedUrl(filePath, expiresIn);
      if (signedRes.error) {
        throw new Error(`Failed to create signed URL: ${signedRes.error.message}`);
      }
      signedUrl = signedRes.data.signedUrl;
    }

    return {
      path: filePath,
      success: true,
      signedUrl,
      publicUrl: client.storage.from(bucketId).getPublicUrl(filePath).data.publicUrl,
    };
  },
});
