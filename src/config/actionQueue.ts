export const ACTION_QUEUE_CONCURRENCY = Math.max(
  1,
  Number((import.meta as any).env?.VITE_ACTION_QUEUE_CONCURRENCY ?? 4)
);

export const ACTION_QUEUE_PANEL_ENABLED = String(
  (import.meta as any).env?.VITE_ACTION_QUEUE_PANEL
).toLowerCase() === 'true';


