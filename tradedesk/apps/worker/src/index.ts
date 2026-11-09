import { runOfficialBacktests } from '@desk/core';
import { createServer } from 'node:http';
import { adminAlert } from '@desk/core';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { dunning, payout } from './jobs/billing';
import { runUserCycle } from './jobs/cycle';
import { dailyReports } from './jobs/report';
import { need, sb } from './lib/env';

const connection = new Redis(need('REDIS_URL'), { maxRetriesPerRequest: null });
connection.on('error', (e) => console.error('[redis]', e.message));
const queue = new Queue('desk', { connection, defaultJobOptions: { removeOnComplete: 100, removeOnFail: 500 } });

let lastTick = Date.now();
const startedAt = Date.now();

// ---- healthcheck HTTP (Fly/Railway/Docker): 200 só se Redis responde e o tick rodou nos últimos 3 min
createServer(async (req, res) => {
  if (req.url !== '/health') { res.writeHead(404).end(); return; }
  let redisOk = false;
  try { redisOk = (await Promise.race([connection.ping(), new Promise<string>((_, rej) => setTimeout(() => rej(new Error('timeout')), 2000))])) === 'PONG'; } catch { /* redis fora */ }
  const age = Date.now() - lastTick;
  const grace = Date.now() - startedAt < 180_000; // no boot, dá 3 min até o 1º tick
  const ok = redisOk && (age < 180_000 || grace);
  res.writeHead(ok ? 200 : 503, { 'content-type': 'application/json' }).end(JSON.stringify({ ok, redisOk, lastTickSecondsAgo: Math.round(age / 1000) }));
}).listen(Number(process.env.PORT ?? 8080), () => console.log('[worker] healthcheck em /health'));


// agenda (UTC; Brasília = UTC-3)
await queue.upsertJobScheduler('tick', { every: 60_000 }, { name: 'tick' });           // a cada minuto
await queue.upsertJobScheduler('report', { pattern: '0 0 * * *' }, { name: 'report' });  // 21:00 BRT
await queue.upsertJobScheduler('official', { pattern: '0 4 * * 1' }, { name: 'official' }); // segunda 01:00 BRT
await queue.upsertJobScheduler('dunning', { pattern: '0 * * * *' }, { name: 'dunning' });   // de hora em hora
await queue.upsertJobScheduler('payout', { pattern: '0 15 * * *' }, { name: 'payout' });    // 12:00 BRT

const worker = new Worker(
  'desk',
  async (job) => {
    switch (job.name) {
      case 'tick': {
        const { data } = await sb.from('bot_settings').select('user_id').eq('bot_enabled', true);
        const slot = Math.floor(Date.now() / 60_000);
        lastTick = Date.now();
        await sb.from('worker_heartbeat').upsert({ id: 1, ts: new Date().toISOString(), info: { bots: data?.length ?? 0, region: process.env.FLY_REGION ?? process.env.RAILWAY_REPLICA_REGION ?? 'n/a' } });
        for (const r of data ?? []) await queue.add('cycle', { userId: r.user_id }, { jobId: `cycle-${r.user_id}-${slot}` });
        return { queued: data?.length ?? 0 };
      }
      case 'cycle': {
        // trava por cliente: nunca dois ciclos simultâneos para a mesma conta
        const lock = `lock:cycle:${job.data.userId}`;
        if (!(await connection.set(lock, '1', 'EX', 55, 'NX'))) return { skipped: 'lock' };
        try { await runUserCycle(job.data.userId); } finally { await connection.del(lock); }
        return;
      }
      case 'report': return { sent: await dailyReports() };
      case 'official': return { out: await runOfficialBacktests(sb) };
      case 'dunning': return { blocked: await dunning() };
      case 'payout': return { result: await payout() };
    }
  },
  { connection, concurrency: Number(process.env.WORKER_CONCURRENCY ?? 5) },
);

worker.on('failed', (job, err) => console.error(`[job ${job?.name}] falhou:`, err.message));
worker.on('ready', () => console.log('[worker] mesa de 6 agentes rodando 24h'));

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { await worker.close(); await queue.close(); process.exit(0); });

// avisa o dono se o worker cair por exceção não tratada
for (const ev of ['uncaughtException', 'unhandledRejection'] as const) {
  process.on(ev, async (e) => { console.error(ev, e); await adminAlert(sb, 'worker-crash', 'Worker com erro fatal', `<p>${ev}: ${String((e as any)?.message ?? e)}</p>`, 30).catch(() => undefined); if (ev === 'uncaughtException') process.exit(1); });
}
