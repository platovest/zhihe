// Optional on-device completion marks only; never contains answers or identity.
const key = 'zhihe-completed-courses-v1';
export type LearningProgress = { remember: boolean; completed: string[] };
const empty = (): LearningProgress => ({ remember: false, completed: [] });
export function readProgress(): LearningProgress {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null');
    return value?.remember === true && Array.isArray(value.completed)
      ? { remember: true, completed: value.completed.filter((item: unknown) => typeof item === 'string') }
      : empty();
  } catch { return empty(); }
}
export function rememberProgress(enabled: boolean): boolean {
  try {
    if (enabled) localStorage.setItem(key, JSON.stringify({remember:true, completed:readProgress().completed}));
    else localStorage.removeItem(key);
    window.dispatchEvent(new Event('zhihe-progress'));
    return true;
  } catch { return false; }
}
export function markComplete(slug: string): boolean {
  const progress = readProgress();
  if (!progress.remember) return false;
  try {
    localStorage.setItem(key, JSON.stringify({remember:true, completed:[...new Set([...progress.completed, slug])]}));
    window.dispatchEvent(new Event('zhihe-progress'));
    return true;
  } catch { return false; }
}
