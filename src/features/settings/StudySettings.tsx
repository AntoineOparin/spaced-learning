import { repo } from '../../db/instance';
import { DEFAULT_SETTINGS, NEW_PER_DAY_MAX, type Settings } from '../../domain/types';
import { Switch } from '../../ui/Field';
import { Select } from '../../ui/Select';
import { IntInput, Row, StepsRow } from './fields';

const HOURS = Array.from({ length: 24 }, (_, h) => h);

export function StudySettings({ settings }: { settings: Settings }) {
  const update = async (patch: Partial<Settings>) => {
    await repo.updateSettings(patch);
  };

  const retention = Math.round(settings.desiredRetention * 100);
  const fill = ((settings.desiredRetention - 0.8) / (0.97 - 0.8)) * 100;
  return (
    <>
      <Row
        stacked
        label={
          <span className="flex items-baseline justify-between gap-4">
            Desired retention
            <span className="text-lg font-extrabold tabular-nums">{retention}%</span>
          </span>
        }
        hint="The chance of recalling a card when it comes due. 90% is a good default; each extra point costs noticeably more reviews. Courses can override this."
      >
        {(id, d) => (
          <input
            id={id}
            aria-describedby={d}
            type="range"
            min={0.8}
            max={0.97}
            step={0.01}
            value={settings.desiredRetention}
            onChange={(e) => void update({ desiredRetention: Number(e.target.value) })}
            className="range w-full"
            style={{ '--fill': `${fill}%` } as React.CSSProperties}
          />
        )}
      </Row>
      <Row label="New cards per day" hint="Per course.">
        {(id, d) => (
          <IntInput
            id={id}
            aria-describedby={d}
            min={0}
            max={NEW_PER_DAY_MAX}
            value={settings.newPerDay}
            className="w-28 text-right tabular-nums"
            onSave={(n) => void update({ newPerDay: n })}
          />
        )}
      </Row>
      <Row label="New day starts at" hint="Late-night reviews count for the previous day.">
        {(id, d) => (
          <Select
            id={id}
            aria-describedby={d}
            value={settings.dayStartHour}
            className="w-28 tabular-nums"
            onChange={(h) => void update({ dayStartHour: h })}
            options={HOURS.map((h) => ({ value: h, label: `${String(h).padStart(2, '0')}:00` }))}
          />
        )}
      </Row>
      <StepsRow
        label="Learning steps"
        hint="Short same-day repeats for new cards, e.g. 1m 10m."
        steps={settings.learningSteps}
        example="1m 10m 1h"
        onSave={(steps) => void update({ learningSteps: steps })}
      />
      <StepsRow
        label="Relearning steps"
        hint="Repeats after you forget a card, e.g. 10m."
        steps={settings.relearningSteps}
        example="10m"
        onSave={(steps) => void update({ relearningSteps: steps })}
      />
      <Row label="Leech threshold" hint="Flag a card after this many lapses.">
        {(id, d) => (
          <IntInput
            id={id}
            aria-describedby={d}
            min={2}
            max={20}
            fallback={DEFAULT_SETTINGS.leechThreshold}
            value={settings.leechThreshold}
            className="w-28 text-right tabular-nums"
            onSave={(n) => void update({ leechThreshold: n })}
          />
        )}
      </Row>
      <div className="px-5 py-4">
        <Switch
          checked={settings.enableFuzz}
          onChange={(v) => void update({ enableFuzz: v })}
          label="Spread out reviews"
          description="Adds a little randomness to long intervals so cards learned together don’t all fall due on the same day."
        />
      </div>
    </>
  );
}
