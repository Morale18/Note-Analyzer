import {
  ALL_NOTES,
  ALL_STRINGS,
  MAX_FRET,
  NATURAL_NOTES,
  STRING_LABELS,
  pitchClassName,
  validateSetup,
  type SettingsInput,
} from '@fretboard/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { useSettings } from '../settings';

function toggled(values: readonly number[], value: number): number[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

function Chip(props: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="chip" data-checked={props.checked}>
      <input type="checkbox" checked={props.checked} onChange={props.onChange} />
      {props.label}
    </label>
  );
}

function Stepper(props: { label: string; value: number; onChange: (value: number) => void }) {
  const { label, value, onChange } = props;
  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <div className="stepper-controls">
        <button
          className="button"
          aria-label={`Decrease ${label}`}
          disabled={value <= 0}
          onClick={() => onChange(value - 1)}
        >
          −
        </button>
        <output className="stepper-value">{value}</output>
        <button
          className="button"
          aria-label={`Increase ${label}`}
          disabled={value >= MAX_FRET}
          onClick={() => onChange(value + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}

function Section(props: { title: string; children: ReactNode }) {
  return (
    <section className="settings-section">
      <h2>{props.title}</h2>
      {props.children}
    </section>
  );
}

export function SettingsPage() {
  const { settings, saveSettings } = useSettings();
  const [draft, setDraft] = useState(settings);

  useEffect(() => setDraft(settings), [settings]);

  const errors = validateSetup(draft);

  function update(patch: Partial<SettingsInput>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (validateSetup(next).length === 0) saveSettings(next);
  }

  return (
    <div className="settings">
      <h1>Settings</h1>

      {errors.length > 0 && (
        <div className="error-message" role="alert">
          {errors.map((message) => (
            <p key={message}>{message}</p>
          ))}
          <p className="error-hint">Until this is fixed, practice uses your last valid setup.</p>
        </div>
      )}

      <Section title="Strings">
        <div className="chip-grid chip-grid-3">
          {ALL_STRINGS.map((stringIndex) => (
            <Chip
              key={stringIndex}
              label={STRING_LABELS[stringIndex]!}
              checked={draft.selectedStrings.includes(stringIndex)}
              onChange={() =>
                update({ selectedStrings: toggled(draft.selectedStrings, stringIndex) })
              }
            />
          ))}
        </div>
      </Section>

      <Section title="Notes">
        <div className="button-row">
          <button className="button" onClick={() => update({ selectedNotes: [...NATURAL_NOTES] })}>
            Naturals only
          </button>
          <button className="button" onClick={() => update({ selectedNotes: [...ALL_NOTES] })}>
            All 12
          </button>
          <button className="button" onClick={() => update({ selectedNotes: [] })}>
            Clear
          </button>
        </div>
        <div className="chip-grid chip-grid-4">
          {ALL_NOTES.map((note) => (
            <Chip
              key={note}
              label={pitchClassName(note, draft.accidentalStyle)}
              checked={draft.selectedNotes.includes(note)}
              onChange={() => update({ selectedNotes: toggled(draft.selectedNotes, note) })}
            />
          ))}
        </div>
      </Section>

      <Section title="Fret range">
        <div className="stepper-row">
          <Stepper
            label="Lowest"
            value={draft.fretMin}
            onChange={(fretMin) => update({ fretMin })}
          />
          <Stepper
            label="Highest"
            value={draft.fretMax}
            onChange={(fretMax) => update({ fretMax })}
          />
        </div>
      </Section>

      <Section title="Note names">
        <div className="segmented">
          {(['sharps', 'flats'] as const).map((accidentalStyle) => (
            <button
              key={accidentalStyle}
              className="segment"
              aria-pressed={draft.accidentalStyle === accidentalStyle}
              onClick={() => update({ accidentalStyle })}
            >
              {accidentalStyle === 'sharps' ? 'Sharps (♯)' : 'Flats (♭)'}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Sensitivity">
        <input
          className="slider"
          type="range"
          min={0}
          max={100}
          value={Math.round(draft.sensitivity * 100)}
          aria-label="Microphone sensitivity"
          onChange={(event) => update({ sensitivity: Number(event.target.value) / 100 })}
        />
        <div className="slider-labels">
          <span>Loud notes only</span>
          <span>{Math.round(draft.sensitivity * 100)}</span>
          <span>Quiet notes too</span>
        </div>
        <p className="hint">
          On the Practice screen, the tick on the level bar is this threshold. Silence should sit
          below it and a played note well above it.
        </p>
      </Section>

      <Section title="Focus">
        <label className="toggle">
          <input
            type="checkbox"
            checked={draft.weightWeakNotes}
            onChange={(event) => update({ weightWeakNotes: event.target.checked })}
          />
          <span>Weight toward weak notes</span>
        </label>
      </Section>
    </div>
  );
}
