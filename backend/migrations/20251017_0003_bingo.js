/** Bingo persistence schema */

/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  await knex.schema.createTable('bingo_rooms', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('code', 20).notNullable().unique();
    t.uuid('host_id').references('id').inTable('users').onDelete('SET NULL');
    t.string('name', 120).notNullable();
    t.string('mode', 16).notNullable().defaultTo('friendly'); // friendly | fire
    t.decimal('entry_price_fire', 18, 2).defaultTo(0);
    t.decimal('pot_fires', 18, 2).defaultTo(0);
    t.string('status', 16).notNullable().defaultTo('open'); // open | running | closed
    t.specificType('numbers_drawn', 'integer[]').notNullable().defaultTo('{}');
    t.jsonb('rules_meta'); // reparto 70/20/10, etc
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('starts_at');
    t.timestamp('ends_at');
    t.index(['host_id']);
  });

  await knex.schema.createTable('bingo_players', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('room_id').notNullable().references('id').inTable('bingo_rooms').onDelete('CASCADE');
    t.text('user_ext').notNullable(); // tg:123, em:abc
    t.uuid('user_id').references('id').inTable('users').onDelete('SET NULL');
    t.decimal('fires_spent', 18, 2).defaultTo(0);
    t.integer('cards_count').defaultTo(0);
    t.string('status', 16).defaultTo('active');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.unique(['room_id','user_ext']);
  });

  await knex.schema.createTable('bingo_cards', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('room_id').notNullable().references('id').inTable('bingo_rooms').onDelete('CASCADE');
    t.uuid('player_id').references('id').inTable('bingo_players').onDelete('SET NULL');
    t.jsonb('card').notNullable(); // estructura del cartón
    t.boolean('is_winner').notNullable().defaultTo(false);
    t.timestamp('claimed_at');
    t.text('claim_ref');
    t.index(['room_id','player_id']);
  });

  await knex.schema.createTable('bingo_draws', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('room_id').notNullable().references('id').inTable('bingo_rooms').onDelete('CASCADE');
    t.integer('number').notNullable();
    t.timestamp('drawn_at').defaultTo(knex.fn.now());
    t.index(['room_id','number']);
  });

  await knex.schema.createTable('bingo_claims', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('room_id').notNullable().references('id').inTable('bingo_rooms').onDelete('CASCADE');
    t.uuid('card_id').references('id').inTable('bingo_cards').onDelete('SET NULL');
    t.text('user_ext').notNullable();
    t.uuid('player_id').references('id').inTable('bingo_players').onDelete('SET NULL');
    t.string('status', 16).notNullable().defaultTo('pending'); // pending | accepted | rejected
    t.text('review_notes');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.index(['room_id','status']);
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('bingo_claims');
  await knex.schema.dropTableIfExists('bingo_draws');
  await knex.schema.dropTableIfExists('bingo_cards');
  await knex.schema.dropTableIfExists('bingo_players');
  await knex.schema.dropTableIfExists('bingo_rooms');
};
