// Testa as políticas RLS REAIS (migrations 001 + 002) num Postgres de verdade (PGlite, WASM), simulando o JWT do Supabase.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { before } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const O = '00000000-0000-0000-0000-0000000000f0';
const db = new PGlite();

async function as(role: 'anon' | 'authenticated' | 'service_role', uid: string | null, aal = 'aal1') {
  await db.exec('reset role');
  await db.exec(`select set_config('request.jwt.claim.sub', '${uid ?? ''}', false), set_config('request.jwt.claims', '${JSON.stringify(uid ? { sub: uid, aal } : {})}', false)`);
  await db.exec(`set role ${role}`);
}
const count = async (sql: string) => Number((await db.query<{ n: number }>(`select count(*)::int as n from (${sql}) t`)).rows[0].n);

before(async () => {
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create publication supabase_realtime;
    grant usage on schema public, auth to anon, authenticated, service_role;
  `);
  const strip = (s: string) => s.replace(/create extension if not exists pgcrypto;/g, '');
  await db.exec(strip(readFileSync(new URL('../../../supabase/migrations/001_init.sql', import.meta.url), 'utf8')));
  await db.exec(readFileSync(new URL('../../../supabase/migrations/002_owner_audit_health.sql', import.meta.url), 'utf8'));
  // grants padrão do Supabase: sem eles o teste passaria por falta de permissão, não por RLS
  await db.exec('grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role; grant execute on all functions in schema public to anon, authenticated;');
  await db.exec(`
    insert into auth.users values ('${A}','a@x.com'),('${B}','b@x.com'),('${O}','dono@x.com');
    insert into profiles (id,email,role) values ('${A}','a@x.com','user'),('${B}','b@x.com','user'),('${O}','dono@x.com','owner');
    insert into subscriptions (user_id,status,value) values ('${A}','active',7000),('${B}','active',7000);
    insert into bot_settings (user_id) values ('${A}'),('${B}');
    insert into exchange_accounts (user_id,exchange,api_key_enc,api_secret_enc,key_hint) values ('${A}','binance','SEGREDO-A','SEGREDO-A','1111'),('${B}','binance','SEGREDO-B','SEGREDO-B','2222');
    insert into trades (user_id,symbol,qty,entry_price,cost,stop_price,target_price,peak_price) values ('${A}','BTC/USDT',1,1,1,1,1,1),('${B}','BTC/USDT',2,2,2,2,2,2);
    insert into bot_logs (user_id,agent,level,message) values ('${A}','scout','info','a'),('${B}','scout','info','b');
    insert into agent_status values ('${A}','scout','idle','',now()),('${B}','scout','idle','',now());
    insert into equity_snapshots values ('${A}',now(),1,'USDT'),('${B}',now(),2,'USDT');
    insert into daily_state values ('${A}',current_date,1,false,null),('${B}',current_date,2,false,null);
    insert into backtests (kind,user_id,exchange,symbol,days,timeframe,params,metrics,equity,data_from,data_to) values
      ('user','${A}','binance','BTC/USDT',30,'1h','{}','{}','[]',now(),now()),
      ('user','${B}','binance','BTC/USDT',30,'1h','{}','{}','[]',now(),now()),
      ('official',null,'binance','BTC/USDT',90,'1h','{}','{}','[]',now(),now());
    insert into payments (asaas_payment_id,user_id,email,value) values ('p-a','${A}','a@x.com',7000),('p-b','${B}','b@x.com',7000);
    insert into app_settings values ('plan_price','{"amount":7000}'),('owner_validation','{"start":"x"}');
    insert into audit_log (actor,action) values ('${O}','owner.login');
    insert into alerts_sent (key) values ('k');
  `);
});

test('usuário A só enxerga os PRÓPRIOS dados (trades, logs, assinatura, perfil, pagamentos...)', async () => {
  await as('authenticated', A);
  for (const t of ['trades', 'bot_logs', 'subscriptions', 'profiles', 'payments', 'bot_settings']) {
    const col = t === 'profiles' ? 'id' : 'user_id';
    assert.equal(await count(`select * from ${t}`), 1, `${t}: deveria ver 1 linha`);
    assert.equal(await count(`select * from ${t} where ${col} = '${B}'`), 0, `${t}: vazou dado do B`);
  }
  for (const t of ['agent_status', 'equity_snapshots', 'daily_state']) assert.equal(await count(`select * from ${t} where user_id = '${B}'`), 0, `${t} vazou`);
});

test('A não lê chaves de corretora (exchange_accounts sem policy), nem auditoria, nem alertas', async () => {
  await as('authenticated', A);
  assert.equal(await count('select * from exchange_accounts'), 0);
  assert.equal(await count('select * from audit_log'), 0);
  assert.equal(await count('select * from alerts_sent'), 0);
  assert.equal(await count('select * from worker_heartbeat'), 0);
  assert.equal(await count('select * from payouts'), 0);
});

test('A vê o próprio backtest + o oficial, nunca o de B; vê só o preço em app_settings', async () => {
  await as('authenticated', A);
  assert.equal(await count(`select * from backtests where user_id = '${B}'`), 0);
  assert.equal(await count(`select * from backtests where kind = 'official'`), 1);
  assert.equal(await count(`select * from backtests where user_id = '${A}'`), 1);
  assert.equal(await count('select * from app_settings'), 1);
});

test('A não consegue escrever: insert/update/delete bloqueados (escrita só via servidor)', async () => {
  await as('authenticated', A);
  await assert.rejects(db.exec(`insert into trades (user_id,symbol,qty,entry_price,cost,stop_price,target_price,peak_price) values ('${A}','ETH/USDT',1,1,1,1,1,1)`));
  await assert.rejects(db.exec(`insert into subscriptions (user_id,status,value) values ('${A}','active',1)`), 'A não pode se dar assinatura');
  const upd = await db.query(`update bot_settings set bot_enabled = true where user_id = '${A}' returning 1`);
  assert.equal(upd.rows.length, 0, 'update deveria afetar 0 linhas');
  const upd2 = await db.query(`update profiles set role = 'owner' where id = '${A}' returning 1`);
  assert.equal(upd2.rows.length, 0, 'ninguém vira owner pela API');
  const del = await db.query(`delete from trades where user_id = '${A}' returning 1`);
  assert.equal(del.rows.length, 0);
});

test('visitante anônimo: nada privado; só backtest oficial', async () => {
  await as('anon', null);
  for (const t of ['trades', 'bot_logs', 'subscriptions', 'profiles', 'payments', 'exchange_accounts', 'bot_settings']) assert.equal(await count(`select * from ${t}`), 0, t);
  assert.equal(await count('select * from backtests'), 1);
});

test('dono SEM 2FA (aal1) não enxerga dados de outros; COM 2FA (aal2) enxerga tudo', async () => {
  await as('authenticated', O, 'aal1');
  assert.equal(await count('select * from trades'), 0, 'aal1 não pode ver trades de clientes');
  assert.equal(await count('select * from audit_log'), 0);
  await as('authenticated', O, 'aal2');
  assert.equal(await count('select * from trades'), 2);
  assert.equal(await count('select * from subscriptions'), 2);
  assert.equal(await count('select * from audit_log'), 1);
  assert.equal(await count('select * from exchange_accounts'), 0, 'nem o dono lê segredos pela API pública');
});

test('um usuário comum com "aal2" mas sem role=owner continua sem acesso extra', async () => {
  await as('authenticated', A, 'aal2');
  assert.equal(await count('select * from trades'), 1);
  assert.equal(await count('select * from audit_log'), 0);
});

test('service_role (servidor/worker) enxerga e escreve tudo', async () => {
  await as('service_role', null);
  assert.equal(await count('select * from trades'), 2);
  assert.equal(await count('select * from exchange_accounts'), 2);
  await db.exec(`insert into bot_logs (user_id,agent,level,message) values ('${A}','x','info','svc')`);
});
