const base = () => process.env.ASAAS_BASE_URL ?? 'https://api.asaas.com/v3';

async function call<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new Error('ASAAS_API_KEY ausente');
  const r = await fetch(`${base()}${path}`, {
    method,
    headers: { 'content-type': 'application/json', access_token: key, 'user-agent': 'neondesk' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Asaas ${r.status}: ${j?.errors?.[0]?.description ?? JSON.stringify(j).slice(0, 200)}`);
  return j as T;
}

export const today = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

export const asaas = {
  createCustomer: (d: { name: string; email: string; cpfCnpj: string; externalReference: string }) =>
    call('POST', '/customers', { ...d, notificationDisabled: false }),

  /** billingType UNDEFINED: o cliente escolhe Pix ou cartão na fatura; o Pix também é exibido no nosso checkout. */
  createSubscription: (d: { customer: string; value: number; externalReference: string; description: string }) =>
    call('POST', '/subscriptions', {
      ...d,
      billingType: 'UNDEFINED',
      cycle: 'MONTHLY',
      nextDueDate: today(),
    }),

  subscriptionPayments: (subId: string) => call('GET', `/subscriptions/${subId}/payments`),
  getPayment: (id: string) => call('GET', `/payments/${id}`),
  pixQr: (paymentId: string) => call<{ encodedImage: string; payload: string; expirationDate: string }>('GET', `/payments/${paymentId}/pixQrCode`),
  /** SANDBOX: marca a cobrança como recebida (simula o pagamento do Pix nos testes). */
  receiveInCash: (id: string, value: number) => call('POST', `/payments/${id}/receiveInCash`, { paymentDate: today(), value, notifyCustomer: false }),
  cancelSubscription: (id: string) => call('DELETE', `/subscriptions/${id}`),
  updateSubscriptionValue: (id: string, value: number) => call('PUT', `/subscriptions/${id}`, { value, updatePendingPayments: false }),

  balance: () => call<{ balance: number }>('GET', '/finance/balance'),
  /** Repasse Pix para OWNER_PIX_KEY. tipo: CPF | CNPJ | EMAIL | PHONE | EVP */
  transferPix: (value: number, key: string, keyType: string) =>
    call('POST', '/transfers', { value, pixAddressKey: key, pixAddressKeyType: keyType, description: 'Repasse automático' }),
};
