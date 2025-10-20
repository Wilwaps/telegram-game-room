/**
 * Welcome events: tabla principal, historial y migración desde app_kv
 */

/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  await knex.schema.createTable('welcome_events', (t) => {
    t.increments('id').primary();
    t.string('name', 120).notNullable();
    t.text('message').notNullable();
    t.integer('coins').notNullable().defaultTo(0);
    t.integer('fires').notNullable().defaultTo(0);
    t.integer('duration_hours').notNullable().defaultTo(24);
    t.timestamp('starts_at');
    t.timestamp('ends_at');
    t.boolean('active').notNullable().defaultTo(false);
    t.string('created_by', 120).notNullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.createTable('welcome_event_history', (t) => {
    t.increments('id').primary();
    t.integer('event_id').notNullable().references('id').inTable('welcome_events').onDelete('CASCADE');
    t.string('action', 32).notNullable();
    t.string('actor', 120).notNullable();
    t.jsonb('payload');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.createTable('welcome_event_claims', (t) => {
    t.integer('event_id').notNullable().references('id').inTable('welcome_events').onDelete('CASCADE');
    t.string('user_ext', 120).notNullable();
    t.timestamp('claimed_at').notNullable().defaultTo(knex.fn.now());
    t.primary(['event_id', 'user_ext']);
  });
  await knex.schema.alterTable('welcome_events', (t) => {
    t.index(['active']);
  });
  await knex.schema.alterTable('welcome_event_history', (t) => {
    t.index(['event_id']);
  });

  // Migrar estado previo de app_kv (si existe)
  try {
    const row = await knex('app_kv').where({ key: 'welcome_event' }).first();
    if (row && row.value) {
      const ev = row.value;
      const now = new Date();
      const startsAt = ev.startsAt ? new Date(ev.startsAt) : now;
      const endsAt = ev.endsAt ? new Date(ev.endsAt) : null;
      const [newId] = await knex('welcome_events')
        .insert({
          name: ev.name || 'Welcome Event',
          message: ev.message || '',
          coins: ev.coins || 0,
          fires: ev.fires || 0,
          duration_hours: ev.durationHours || Math.max(1, Math.floor(((ev.endsAt || startsAt) - startsAt) / 3600000) || 24),
          starts_at: startsAt,
          ends_at: endsAt,
          active: !!ev.active && (!ev.endsAt || Date.now() < Number(ev.endsAt)),
          created_by: 'migration',
        })
        .returning('id');
      const eventId = Array.isArray(newId) ? newId[0] : newId;
      await knex('welcome_event_history').insert({
        event_id: eventId,
        action: 'migrated',
        actor: 'migration',
        payload: ev,
      });
      if (ev.active) {
        const exists = await knex('app_kv').where({ key: 'welcome_current_event_id' }).first();
        if (exists) {
          await knex('app_kv').where({ key: 'welcome_current_event_id' }).update({ value: eventId, updated_at: knex.fn.now() });
        } else {
          await knex('app_kv').insert({ key: 'welcome_current_event_id', value: eventId, updated_at: knex.fn.now() });
        }
      }
      // Migrar claims antiguos (globales) al nuevo evento
      const hasLegacyClaims = await knex.schema.hasTable('welcome_claims');
      if (hasLegacyClaims) {
        const legacyClaims = await knex('welcome_claims');
        if (Array.isArray(legacyClaims) && legacyClaims.length>0) {
          const rows = legacyClaims.map((c)=>({ event_id: eventId, user_ext: c.user_ext, claimed_at: c.claimed_at || knex.fn.now() }));
          await knex('welcome_event_claims').insert(rows).onConflict(['event_id','user_ext']).ignore();
        }
      }
    }
  } catch (err) {
    console.warn('welcome_events migration skipped legacy app_kv:', err.message || err);
  }
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('welcome_event_claims');
  await knex.schema.dropTableIfExists('welcome_event_history');
  await knex.schema.dropTableIfExists('welcome_events');
  try {
    await knex('app_kv').where({ key: 'welcome_current_event_id' }).del();
  } catch (_) {}
};

