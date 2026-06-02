import { NextRequest, NextResponse } from 'next/server'
import { setSession } from '@/lib/session'

export async function POST(request: NextRequest) {
  const { username, password } = await request.json()

  const validUser = process.env.ADMIN_USERNAME || 'admin'
  const validPass = process.env.ADMIN_PASSWORD || 'gimcontz'

  if (username !== validUser || password !== validPass) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  await setSession(username)
  return NextResponse.json({ ok: true })
}
