import { S3Client } from '@aws-sdk/client-s3';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: accessKeyId || '',
    secretAccessKey: secretAccessKey || '',
  },
});

export const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'galeria-joana';
export const R2_PUBLIC_URL = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '').replace(/\/+$/, '');
