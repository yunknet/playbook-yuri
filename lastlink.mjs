const events = {
  Purchase_Order_Confirmed: 'aprovada',
  Payment_Refund: 'reembolsada',
  Payment_Chargeback: 'chargeback'
};

function instant(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = /(?:Z|[+-]\d\d:\d\d)$/i.test(value) ? value : value + 'Z';
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function parseLastlinkEvent(payload, productId) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {kind: 'invalid'};
  if (payload.IsTest === true) return {kind: 'test'};
  const status = events[payload.Event];
  if (!status) return {kind: 'ignored'};
  const data = payload.Data;
  if (!data || !Array.isArray(data.Products)) return {kind: 'invalid'};
  if (!data.Products.some(product => product?.Id === productId)) return {kind: 'other-product'};
  const paymentId = data.Purchase?.PaymentId;
  const email = typeof data.Buyer?.Email === 'string' ? data.Buyer.Email.trim().toLowerCase() : '';
  const name = typeof data.Buyer?.Name === 'string' ? data.Buyer.Name.trim().slice(0, 500) : '';
  const eventAt = instant(payload.CreatedAt);
  const approvedAt = status === 'aprovada' ? instant(data.Purchase?.PaymentDate) : null;
  if (typeof paymentId !== 'string' || !paymentId.trim() || paymentId.length > 200 ||
      typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 || !eventAt || (status === 'aprovada' && !approvedAt)) return {kind: 'invalid'};
  return {kind: 'purchase', paymentId: paymentId.trim(), email, name, status, eventAt, approvedAt};
}
