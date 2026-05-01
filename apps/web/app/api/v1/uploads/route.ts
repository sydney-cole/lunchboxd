import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { z } from 'zod/v4'

const uploadRequestSchema = z.object({
  contentType: z.string(),
  type: z.enum(['review', 'avatar']).default('review'),
})

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  if (!accountId || !accessKeyId || !secretAccessKey) return null

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
}

export async function POST(req: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const r2 = getR2Client()
  if (!r2) {
    return NextResponse.json(
      { error: 'Photo upload is not configured. R2 credentials missing.' },
      { status: 503 }
    )
  }

  const body = await req.json()
  const parsed = uploadRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 }
    )
  }
  const { contentType, type } = parsed.data
  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(contentType)) {
    return NextResponse.json(
      { error: 'Invalid content type. Allowed: image/jpeg, image/png, image/webp' },
      { status: 400 }
    )
  }

  const prefix = type === 'avatar' ? 'avatars' : 'reviews'
  const key = `${prefix}/${clerkId}/${randomUUID()}`
  const url = await getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 300 }
  )

  return NextResponse.json({ uploadUrl: url, key })
}
