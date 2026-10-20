import { Dialog } from '../../ui/Dialog';
import { Kbd } from '../../ui/misc';

const SHORTCUTS: [string[], string][] = [
  [['Space', 'Enter'], 'Show answer, then rate Good'],
  [['1', '2', '3', '4'], 'Again · Hard · Good · Easy'],
  [['U', '⌘Z'], 'Undo last rating'],
  [['E'], 'Edit this item'],
  [['S'], 'Suspend this card'],
  [['I'], 'Show / hide explanation'],
  [['T'], 'Toggle typing answers'],
  [['D'], 'Toggle drawing answers'],
  [['Esc'], 'End session'],
  [['?'], 'This help'],
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts" size="sm">
      <dl className="divide-y divide-line text-sm">
        {SHORTCUTS.map(([keys, action]) => (
          <div key={action} className="flex items-center justify-between gap-4 py-2.5">
            <dt className="flex gap-1">
              {keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </dt>
            <dd className="text-right">{action}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
