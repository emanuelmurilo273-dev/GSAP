/** Data (YYYY-MM-DD) no fuso de Brasília — o "dia" do limite de perda diária. */
export const brtDay = (d = new Date()) => new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
export const brtDayStartUtc = (day = brtDay()) => new Date(`${day}T03:00:00.000Z`);
