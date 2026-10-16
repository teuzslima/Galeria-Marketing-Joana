import { NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from '@/lib/r2';

export async function POST(request: Request) {
  try {
    const { galleryId, filename, contentType } = await request.json();

    if (!galleryId || !filename || !contentType) {
      return NextResponse.json({ error: 'Parâmetros incompletos' }, { status: 400 });
    }

    const fileExtension = filename.split('.').pop() || 'mp4';
    const uniqueKey = `${galleryId}/${crypto.randomUUID()}.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: uniqueKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 900 });
    const publicUrl = `${R2_PUBLIC_URL}/${uniqueKey}`;

    return NextResponse.json({
      uploadUrl,
      publicUrl,
      storageKey: uniqueKey,
    });
  } catch (error: any) {
    console.error('ERRO NO R2 PRESIGNED:', error);
    return NextResponse.json({ error: error?.message || 'Erro interno no R2' }, { status: 500 });
  }
}