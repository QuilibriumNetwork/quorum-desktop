import * as React from 'react';
import { useActionQueue } from '../context/ActionQueue';
import { useMessageDB } from '../context/useMessageDB';

export const ActionQueuePanel: React.FC = () => {
  const { counts } = useActionQueue();
  const { messageDB } = useMessageDB();
  const [pending, setPending] = React.useState<any[]>([]);
  const [processing, setProcessing] = React.useState<any[]>([]);
  const [failed, setFailed] = React.useState<any[]>([]);

  const refresh = React.useCallback(async () => {
    setPending(await messageDB.getQueueTasksByStatus('pending'));
    setProcessing(await messageDB.getQueueTasksByStatus('processing'));
    setFailed(await messageDB.getQueueTasksByStatus('failed'));
  }, [messageDB]);

  React.useEffect(() => {
    refresh();
  }, [counts, refresh]);

  return (
    <div className="fixed bottom-4 left-4 bg-surface-2 border border-default rounded-md p-3 shadow-xl max-w-[420px] max-h-[60vh] overflow-auto z-[2147483646]">
      <div className="text-sm font-bold mb-2">Background Tasks</div>
      <div className="text-xs mb-2">Pending: {counts.pending} • Processing: {counts.processing} • Failed: {counts.failed}</div>
      <Section title="Pending" items={pending} />
      <Section title="Processing" items={processing} />
      <Section title="Failed" items={failed} />
    </div>
  );
};

const Section: React.FC<{ title: string; items: any[] }> = ({ title, items }) => {
  if (!items.length) return null;
  return (
    <div className="mb-3">
      <div className="text-xs font-semibold mb-1">{title}</div>
      <ul className="space-y-1">
        {items.map((t) => (
          <li key={t.id} className="text-xs p-2 rounded bg-surface-1 border border-default">
            <div className="opacity-80">{t.taskType}</div>
            <div className="opacity-60 break-words">{JSON.stringify(t.context)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
};


