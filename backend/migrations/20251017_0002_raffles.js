/** Raffles persistence schema */

/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  await knex.schema.createTable('raffles', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('code', 20).notNullable().unique();
    t.uuid('host_id').references('id').inTable('users').onDelete('SET NULL');
    t.string('name', 120).notNullable();
    t.string('mode', 16).notNullable(); // fire | prize | free
    t.decimal('entry_price_fire', 18, 2).defaultTo(0);
    t.decimal('entry_price_fiat', 18, 2).defaultTo(0);
    t.string('range', 16).defaultTo('00-99');
    t.string('visibility', 16).defaultTo('public');
    t.string('status', 16).defaultTo('open'); // open | running | closed
    t.decimal('pot_fires', 18, 2).defaultTo(0);
    t.jsonb('host_meta');
    t.jsonb('prize_meta');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('ends_at');
    t.index(['host_id']);
  });

  await knex.schema.createTable('raffle_numbers', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('raffle_id').notNullable().references('id').inTable('raffles').onDelete('CASCADE');
    t.integer('number_idx').notNullable();
    t.string('state', 16).notNullable().defaultTo('available'); // available | reserved | sold
    t.text('reserved_by_ext'); // tg:123, em:abc, etc
    t.timestamp('reserved_until');
    t.text('sold_to_ext');
    t.text('reference');
    t.timestamp('updated_at').defaultTo(knex.fn.now());
    t.unique(['raffle_id', 'number_idx']);
    t.index(['raffle_id', 'state']);
  });

  await knex.schema.createTable('raffle_participants', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('raffle_id').notNullable().references('id').inTable('raffles').onDelete('CASCADE');
    t.text('user_ext').notNullable();
    t.uuid('user_id').references('id').inTable('users').onDelete('SET NULL');
    t.specificType('numbers', 'integer[]').notNullable().defaultTo('{}');
    t.decimal('fires_spent', 18, 2).defaultTo(0);
    t.string('status', 16).defaultTo('active');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.index(['raffle_id', 'user_ext']);
  });

  await knex.schema.createTable('raffle_pending_requests', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('raffle_id').notNullable().references('id').inTable('raffles').onDelete('CASCADE');
    t.integer('number_idx').notNullable();
    t.text('user_ext').notNullable();
    t.text('reference');
    t.text('proof_url');
    t.string('status', 16).defaultTo('pending'); // pending | approved | rejected
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.index(['raffle_id', 'status']);
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('raffle_pending_requests');
  await knex.schema.dropTableIfExists('raffle_participants');
  await knex.schema.dropTableIfExists('raffle_numbers');
  await knex.schema.dropTableIfExists('raffles');
};
