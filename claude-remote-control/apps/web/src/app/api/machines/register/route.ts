import { NextResponse } from 'next/server';
import { db, machines } from '@/lib/db';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
  // Validate API key
  const authHeader = request.headers.get('authorization');
  const expectedKey = `Bearer ${process.env.AGENT_API_KEY}`;

  if (authHeader !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { id, name, config } = body;

  // Upsert machine
  const existing = await db.select().from(machines).where(eq(machines.id, id));

  if (existing.length > 0) {
    await db
      .update(machines)
      .set({
        name,
        status: 'online',
        lastSeen: new Date(),
        config,
      })
      .where(eq(machines.id, id));
  } else {
    await db.insert(machines).values({
      id,
      name,
      status: 'online',
      lastSeen: new Date(),
      config,
    });
  }

  return NextResponse.json({ success: true });
}
