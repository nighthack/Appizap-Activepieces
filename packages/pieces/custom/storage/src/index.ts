import { createPiece, PieceAuth, Property } from '@activepieces/pieces-framework';
import { readAFile } from './lib/actions/read-a-file';
import { createSignedUrl } from './lib/actions/create-signed-url';
import { deleteFile } from './lib/actions/deleteFile';
import { uploadFile } from './lib/actions/uploadFile';
import { listFiles } from './lib/actions/listFiles';
import { storageLogo } from './storage-logo';

import dotenv from 'dotenv';
dotenv.config();

export const storageAuth = PieceAuth.CustomAuth({
  required: true,
  props: {
    orgId: Property.ShortText({
      displayName: 'Organization ID',
      required: true,
    }),
  },
  validate: async ({ auth }) => {
    const orgId = auth.orgId;
    const baseUrl = process.env['AP_NODE_SERVICE_URL'];

    if (!baseUrl) {
      return {
        valid: false,
        error: 'Environment variable AP_NODE_SERVICE_URL is missing. Please check the .env file and restart the server.',
      };
    }

    const url = `${baseUrl}/node-service/api/dbBuilder/${orgId}/customQuery`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: 'select current_role;' }),
      });

      if (response.ok) {
        return {
          valid: true,
          displayName: `Org ${orgId} is valid`,
        };
      } else {
        const errorText = await response.text();
        return {
          valid: false,
          error: `(${response.status}) ${errorText || 'Validation failed'}`,
        };
      }
    } catch (error: any) {
      return {
        valid: false,
        error: `Exception: ${error?.message || 'Connection validation failed'}`,
      };
    }
  },
});

export const storage = createPiece({
  displayName: 'Storage',
  auth: storageAuth,
  minimumSupportedRelease: '0.36.1',
  logoUrl: storageLogo,
  authors: [],
  actions: [readAFile,createSignedUrl,deleteFile,uploadFile,listFiles],
  triggers: [],
});
