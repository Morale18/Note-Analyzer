import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** A single row for now, always with id = 1. */
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey(),
  selectedStrings: text('selected_strings', { mode: 'json' }).$type<number[]>().notNull(),
  selectedNotes: text('selected_notes', { mode: 'json' }).$type<number[]>().notNull(),
  fretMin: integer('fret_min').notNull(),
  fretMax: integer('fret_max').notNull(),
  accidentalStyle: text('accidental_style', { enum: ['sharps', 'flats'] }).notNull(),
  sensitivity: real('sensitivity').notNull(),
  weightWeakNotes: integer('weight_weak_notes', { mode: 'boolean' }).notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  startedAt: integer('started_at').notNull(),
  endedAt: integer('ended_at'),
});

export const attempts = sqliteTable(
  'attempts',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    stringIndex: integer('string_index').notNull(),
    targetNote: integer('target_note').notNull(),
    targetMidi: integer('target_midi').notNull(),
    playedMidi: integer('played_midi').notNull(),
    correct: integer('correct', { mode: 'boolean' }).notNull(),
    responseTimeMs: integer('response_time_ms').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('attempts_session_id_idx').on(table.sessionId)],
);
