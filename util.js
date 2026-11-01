export const fmtNum = (n) => Number(n).toLocaleString('es-ES');
export const fmtMB = (b) => (b / 1048576).toFixed(1).replace('.', ',') + ' MB';
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString('es-ES') : '—');
export const daysSince = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

// Estado de la última copia frente al plazo definido por el usuario (si lo ha definido).
export function backupState(lastBackup, reminderDays) {
  if (!lastBackup) return { level: 'warn', text: 'Todavía no has creado ninguna copia de seguridad en este navegador.' };
  const days = daysSince(lastBackup.at);
  if (Number.isFinite(reminderDays) && days > reminderDays) {
    return { level: 'warn', text: `La última copia tiene ${days} días (el límite que definiste es ${reminderDays}).` };
  }
  return { level: 'ok', text: `Última copia: ${fmtDate(lastBackup.at)}.` };
}
