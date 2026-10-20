import { useState } from 'react';
import { BUNDLED_DECKS, type BundledDeck } from '../../content/decks';
import { repo } from '../../db/instance';
import { installContentPack } from '../../io/contentPack';
import { contentPackSchema } from '../../io/schema';
import { errorMessage } from '../../lib/errors';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { useToast } from '../../ui/Toast';
import { InstallDeckDialog } from '../decks/InstallDeckDialog';
import { JsonFileButton, Row, Section, useJsonFileReader } from './fields';

export function ContentSection() {
  const toast = useToast();
  const readJsonFile = useJsonFileReader();
  const [deck, setDeck] = useState<BundledDeck | null>(null);
  const [installing, setInstalling] = useState(false);

  const onPickPack = async (file: File) => {
    const pack = await readJsonFile(file, contentPackSchema, 'content pack');
    if (!pack) return;
    try {
      const summary = await installContentPack(repo, pack);
      toast({
        tone: 'success',
        message: `Imported ${summary.itemsCreated} items (${summary.itemsSkipped} already present)`,
      });
    } catch (err) {
      toast({ tone: 'error', message: `Import failed: ${errorMessage(err)}` });
    }
  };

  return (
    <Section title="Content">
      {BUNDLED_DECKS.map((d) => (
        <Row key={d.id} label={d.title} hint={d.description}>
          <Button
            size="sm"
            onClick={() => {
              setDeck(d);
              setInstalling(true);
            }}
          >
            Install / update
          </Button>
        </Row>
      ))}
      <Row
        label="Import content pack"
        hint={
          <>
            Add courses and items from a{' '}
            <code className="font-mono text-xs">spaced-learning-content</code> JSON file. Existing
            items are never duplicated.
          </>
        }
      >
        <JsonFileButton onPick={(file) => void onPickPack(file)}>
          <Icon name="upload" size={16} /> Import…
        </JsonFileButton>
      </Row>
      <InstallDeckDialog
        key={deck?.id}
        deck={deck ?? undefined}
        open={installing}
        onClose={() => setInstalling(false)}
      />
    </Section>
  );
}
