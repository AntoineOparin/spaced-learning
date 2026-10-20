import { type ReactNode, useEffect } from 'react';
import { useLocation } from 'react-router';
import { useSettings } from '../../db/hooks';
import { repo } from '../../db/instance';
import { Button } from '../../ui/Button';
import { useConfirm } from '../../ui/Confirm';
import { PageHeader } from '../../ui/misc';
import { useToast } from '../../ui/Toast';
import { AppearanceSection } from './AppearanceSection';
import { BackupSection } from './BackupSection';
import { ContentSection } from './ContentSection';
import { Row, Section } from './fields';
import { StudySettings } from './StudySettings';
import { SyncSection } from './SyncSection';

const PRINCIPLES: [string, ReactNode][] = [
  [
    'Recall first.',
    <>
      Try to answer from memory before revealing — that effort is what strengthens memory. Typing or
      drawing your answer (press <kbd className="font-mono">T</kbd> or{' '}
      <kbd className="font-mono">D</kbd> in a session) makes the attempt concrete.
    </>,
  ],
  [
    'Rate honestly.',
    'Again = forgot; Hard = recalled with real effort; Good = recalled; Easy = instant. The FSRS scheduler uses these to predict when you’d forget each card.',
  ],
  [
    'Write small cards.',
    'One fact per item. Use cloze deletions for long formulas, add a short “why” explanation, and rewrite cards that keep failing (leeches).',
  ],
  [
    'Mix it up.',
    'Sessions interleave topics so you learn to tell similar formulas and techniques apart — that’s harder, and it works better.',
  ],
];

function DangerZone() {
  const toast = useToast();
  const confirm = useConfirm();
  const resetDevice = async () => {
    const ok = await confirm({
      title: 'Reset this device?',
      body: 'This deletes all data stored on this device. Synced data stays on the server and comes back on the next sync.',
      confirmLabel: 'Erase this device',
      typeToConfirm: 'ERASE',
    });
    if (!ok) return;
    await repo.resetDevice();
    toast({ message: 'Device reset' });
    window.location.assign('/');
  };
  return (
    <Section title="Danger zone">
      <Row
        label="Reset this device"
        hint="Erase everything stored on this device. The server copy is not affected."
      >
        <Button variant="danger" size="sm" onClick={() => void resetDevice()}>
          Reset this device
        </Button>
      </Row>
    </Section>
  );
}

export default function SettingsPage() {
  const settings = useSettings();
  const location = useLocation();

  // Scroll once the study settings have rendered: they push the later sections down.
  const loaded = settings !== undefined;
  useEffect(() => {
    if (location.hash && loaded)
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [location.hash, loaded]);

  return (
    <div className="mx-auto max-w-[720px]">
      <PageHeader title="Settings" />
      <div className="space-y-10">
        <AppearanceSection />
        <Section title="Study">{settings ? <StudySettings settings={settings} /> : null}</Section>
        <SyncSection />
        <BackupSection />
        <ContentSection />
        <Section title="How this app works" plain>
          <ul className="space-y-4 text-[15px] text-muted">
            {PRINCIPLES.map(([lead, body]) => (
              <li key={lead}>
                <strong className="font-bold text-fg">{lead}</strong> {body}
              </li>
            ))}
          </ul>
        </Section>
        <DangerZone />
      </div>
    </div>
  );
}
