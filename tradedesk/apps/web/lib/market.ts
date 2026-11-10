/** Horário da B3 (aproximado: não conhece feriados). O robô de verdade usa o calendário completo; aqui é só o texto da tela. */
export function b3Status(now = new Date()): { open: boolean; text: string } {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  const wd = g('weekday'), mins = (Number(g('hour')) % 24) * 60 + Number(g('minute'));
  const weekday = !['Sat', 'Sun'].includes(wd);
  if (weekday && mins >= 9 * 60 && mins < 18 * 60) return { open: true, text: 'Pregão aberto' };
  const nextMon = wd === 'Fri' && mins >= 18 * 60 || wd === 'Sat' || wd === 'Sun';
  return { open: false, text: `Pregão encerrado · abre ${nextMon ? 'segunda às' : weekday && mins < 9 * 60 ? 'hoje às' : 'amanhã às'} 09:00` };
}
