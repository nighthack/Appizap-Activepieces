import { createAction, Property } from '@activepieces/pieces-framework';
import { createClient } from '@supabase/supabase-js';
import path from 'node:path';
import { getUUID, getBuckets } from './utils';

export const listFiles = createAction({
  name: 'list_files',
  displayName: 'List Files',
  description: 'List files from a Supabase Storage bucket',
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
      displayName: 'File Path (Folder)',
      required: false,
      defaultValue: '',
    }),
    returnAll: Property.Checkbox({
      displayName: 'Return All',
      required: true,
      defaultValue: true,
    }),
    limit: Property.Number({
      displayName: 'Limit',
      required: false,
      defaultValue: 50,
    }),
    offset: Property.Number({
      displayName: 'Offset',
      required: false,
      defaultValue: 0,
    }),
    sortBy: Property.Json({
      displayName: 'Sort By',
      required: false,
      defaultValue: {
        column: 'name',
        order: 'asc',
      },
    }),
    return_signed_url: Property.Checkbox({
      displayName: 'Return Signed URL',
      required: true,
      defaultValue: false,
    }),
  },

  async run(context) {
    const {
      bucketId,
      filePath,
      returnAll,
      limit,
      offset,
      return_signed_url,
      sortBy,
    } = context.propsValue;

    const supabaseUrl = process.env['AP_SUPABASE_GATEWAY'];
    const supabaseKey = process.env['AP_SUPABASE_API_KEY'];

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase Gateway URL or API Key not configured.');
    }

    const client = createClient(supabaseUrl, supabaseKey, {
      global: { fetch: fetch as any },
    });

const listOptions: any = {
  limit: returnAll ? undefined : limit,
  offset: returnAll ? undefined : offset,
  sortBy: sortBy || undefined,
};


    const result = await client.storage.from(bucketId).list(filePath || '', listOptions);
    if (result.error) {
      throw new Error(`Failed to list files: ${result.error.message}`);
    }

    const files = result.data || [];

    const expiresIn = 60 * 5; // 5 minutes
    let signedUrlMap: Record<string, string> = {};

    if (return_signed_url && files.length > 0) {
      const paths = files.map(file => path.join(filePath || '', file.name));
      const signRes = await client.storage.from(bucketId).createSignedUrls(paths, expiresIn);
      if (signRes.error) {
        throw new Error(`Failed to create signed URLs: ${signRes.error.message}`);
      }

      signRes.data.forEach(item => {
        if (item.path) {
          signedUrlMap[item.path] = item.signedUrl;
        }
      });
    }

    return {
      files: files.map(file => ({
        ...file,
        signedUrl: return_signed_url
          ? signedUrlMap[path.join(filePath || '', file.name)]
          : undefined,
        publicUrl: client.storage.from(bucketId).getPublicUrl(path.join(filePath || '', file.name)).data.publicUrl,
      })),
    };
  },
});
