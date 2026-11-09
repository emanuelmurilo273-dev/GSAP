import { NextResponse } from 'next/server';
import { twoFactorRequired } from '@/lib/owner';

/** O front só precisa saber se o 2FA é exigido (false somente em instalação local). */
export async function GET() {
  return NextResponse.json({ requires2fa: twoFactorRequired() });
}
