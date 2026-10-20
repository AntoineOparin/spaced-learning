import { useState } from 'react';
import { getThemePref, setThemePref, type ThemePref } from '../../lib/theme';
import { Segmented } from '../../ui/Field';
import type { IconName } from '../../ui/Icon';
import { Row, Section } from './fields';

const OPTIONS: { value: ThemePref; label: string; icon: IconName }[] = [
  { value: 'system', label: 'System', icon: 'monitor' },
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
];

export function AppearanceSection() {
  const [pref, setPref] = useState<ThemePref>(getThemePref);
  return (
    <Section title="Appearance">
      <Row label="Theme">
        <Segmented
          legend="Theme"
          value={pref}
          onChange={(v) => {
            setPref(v);
            setThemePref(v);
          }}
          options={OPTIONS}
          className="w-full sm:w-80"
        />
      </Row>
    </Section>
  );
}
