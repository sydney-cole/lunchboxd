import { put } from '@vercel/blob'
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export async function POST(req: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const type = (formData.get('type') as string) === 'avatar' ? 'avatar' : 'review'

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type. Allowed: JPEG, PNG, WebP' },
      { status: 400 }
    )
  }

  const prefix = type === 'avatar' ? 'avatars' : 'reviews'
  const key = `${prefix}/${clerkId}/${randomUUID()}`

  try {
    const blob = await put(key, file, { access: 'public', contentType: file.type })
    return NextResponse.json({ url: blob.url, key: blob.pathname })
  } catch {
    return NextResponse.json(
      { error: 'Upload failed. Check that BLOB_READ_WRITE_TOKEN is configured.' },
      { status: 503 }
    )
  }
}
