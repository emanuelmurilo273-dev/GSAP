// Corretora simulada (superfície do ccxt usada pelo robô) + Supabase falso em memória.
export class MockExchange {
  id = 'binance';
  markets: Record<string, any> = {};
  prices: Record<string, number> = {};
  balances: Record<string, { free: number; total: number }> = {};
  orders: any[] = [];
  calls: string[] = [];
  failStop = false;
  fee = 0.001;
  private seq = 0;
  constructor(quote = 'USDT', quoteBalance = 10_000) { this.balances[quote] = { free: quoteBalance, total: quoteBalance }; }
  setPrice(sym: string, p: number) { this.prices[sym] = p; this.markets[sym] = {}; }
  async loadMarkets() { return this.markets; }
  market(_s: string) { return { limits: { cost: { min: 10 }, amount: { min: 0.00001 } } }; }
  amountToPrecision(_s: string, a: number) { return String(Math.floor(a * 1e6) / 1e6); }
  priceToPrecision(_s: string, p: number) { return String(Math.round(p * 100) / 100); }
  async fetchTicker(s: string) { return { last: this.prices[s], bid: this.prices[s], ask: this.prices[s], quoteVolume: 1e9 }; }
  async fetchBalance() {
    const free: any = {}, total: any = {};
    for (const [k, v] of Object.entries(this.balances)) { free[k] = v.free; total[k] = v.total; }
    return { free, total };
  }
  private bal(c: string) { return (this.balances[c] ??= { free: 0, total: 0 }); }
  async createOrder(sym: string, type: string, side: string, amount: number, price?: number, params: any = {}) {
    this.calls.push(`${type}:${side}:${amount}`);
    const [base, quote] = sym.split('/');
    const last = this.prices[sym];
    if (type === 'market') {
      if (side === 'buy') {
        const cost = amount * last, fee = cost * this.fee;
        if (this.bal(quote).free < cost + fee) throw new Error('saldo insuficiente');
        this.bal(quote).free -= cost + fee; this.bal(quote).total -= cost + fee;
        this.bal(base).free += amount; this.bal(base).total += amount;
        const o = { id: `o${++this.seq}`, symbol: sym, status: 'closed', average: last, filled: amount, fee: { currency: quote, cost: fee } };
        this.orders.push(o); return o;
      }
      if (this.bal(base).free < amount - 1e-9) throw new Error('saldo de base insuficiente');
      const gross = amount * last, fee = gross * this.fee;
      this.bal(base).free -= amount; this.bal(base).total -= amount;
      this.bal(quote).free += gross - fee; this.bal(quote).total += gross - fee;
      const o = { id: `o${++this.seq}`, symbol: sym, status: 'closed', average: last, filled: amount, fee: { currency: quote, cost: fee } };
      this.orders.push(o); return o;
    }
    if (type === 'STOP_LOSS_LIMIT') {
      if (this.failStop) throw new Error('stop rejeitado pela corretora');
      this.bal(base).free -= amount; // trava a quantidade
      const o = { id: `o${++this.seq}`, symbol: sym, status: 'open', stopPrice: params.stopPrice, limit: price, amount, filled: 0 };
      this.orders.push(o); return o;
    }
    throw new Error(`tipo não suportado: ${type}`);
  }
  async fetchOrder(id: string, _s?: string) { const o = this.orders.find((x) => x.id === id); if (!o) throw new Error('ordem não existe'); return o; }
  async cancelOrder(id: string, _s?: string) {
    const o = this.orders.find((x) => x.id === id);
    if (o?.status === 'open') { o.status = 'canceled'; this.bal(o.symbol.split('/')[0]).free += o.amount; }
    return o;
  }
  /** move o preço e dispara stops da corretora (como a Binance faria). */
  movePrice(sym: string, p: number) {
    this.prices[sym] = p;
    const [base, quote] = sym.split('/');
    for (const o of this.orders) {
      if (o.status === 'open' && o.symbol === sym && p <= o.stopPrice) {
        o.status = 'closed'; o.filled = o.amount; o.average = o.limit;
        const gross = o.amount * o.limit, fee = gross * this.fee;
        this.bal(base).total -= o.amount; this.bal(quote).free += gross - fee; this.bal(quote).total += gross - fee;
        o.fee = { currency: quote, cost: fee };
      }
    }
  }
}

const KEYS: Record<string, string[]> = { daily_state: ['user_id', 'day'], agent_status: ['user_id', 'agent'], symbol_state: ['user_id', 'symbol'], app_settings: ['key'] };

export class FakeSb {
  t: Record<string, any[]> = {};
  private id = 0;
  from(table: string) { return new Q(this, table); }
  rows(table: string) { return (this.t[table] ??= []); }
  nextId() { return `id${++this.id}`; }
}
class Q {
  op = 'select'; payload: any; filters: [string, any][] = []; ret = false; lim: number | null = null; ord: [string, boolean] | null = null; opts: any = {};
  constructor(private db: FakeSb, private table: string) {}
  select(_c?: string) { if (this.op !== 'select') this.ret = true; return this; }
  insert(v: any) { this.op = 'insert'; this.payload = v; return this; }
  update(v: any) { this.op = 'update'; this.payload = v; return this; }
  upsert(v: any, o: any = {}) { this.op = 'upsert'; this.payload = v; this.opts = o; return this; }
  eq(k: string, v: any) { this.filters.push([k, v]); return this; }
  limit(n: number) { this.lim = n; return this; }
  order(k: string, o: any = {}) { this.ord = [k, o.ascending !== false]; return this; }
  maybeSingle() { return this.run().then((r) => ({ data: r.data?.[0] ?? null, error: r.error })); }
  single() { return this.run().then((r) => (r.data?.[0] ? { data: r.data[0], error: null } : { data: null, error: r.error ?? { message: 'sem linhas' } })); }
  then(res: any, rej?: any) { return this.run().then(res, rej); }
  private match(r: any) { return this.filters.every(([k, v]) => r[k] === v); }
  async run(): Promise<{ data: any[] | null; error: any }> {
    const rows = this.db.rows(this.table);
    if (this.op === 'insert') {
      const items = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((p: any) => ({ id: this.db.nextId(), ts: new Date().toISOString(), entry_at: new Date().toISOString(), status: this.table === 'trades' ? 'open' : undefined, ...(this.table === 'daily_state' ? { halted: false } : {}), ...p }));
      for (const it of items) {
        if (this.table === 'trades' && rows.some((r) => r.user_id === it.user_id && r.symbol === it.symbol && r.status === 'open')) return { data: null, error: { message: 'duplicate key: trades_one_open_per_symbol' } };
      }
      rows.push(...items);
      return { data: this.ret ? items : null, error: null };
    }
    if (this.op === 'upsert') {
      const keys = KEYS[this.table] ?? ['id'];
      for (const p of Array.isArray(this.payload) ? this.payload : [this.payload]) {
        const ex = rows.find((r) => keys.every((k) => r[k] === p[k]));
        if (ex) Object.assign(ex, p); else rows.push({ ...p });
      }
      return { data: null, error: null };
    }
    if (this.op === 'update') {
      const hit = rows.filter((r) => this.match(r));
      hit.forEach((r) => Object.assign(r, this.payload));
      return { data: this.ret ? hit : null, error: null };
    }
    let out = rows.filter((r) => this.match(r));
    if (this.ord) { const [k, asc] = this.ord; out = [...out].sort((a, b) => (a[k] > b[k] ? 1 : -1) * (asc ? 1 : -1)); }
    if (this.lim) out = out.slice(0, this.lim);
    return { data: out, error: null };
  }
}
