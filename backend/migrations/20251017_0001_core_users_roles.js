/**
 * Core schema: roles, users, auth_identities, user_roles, wallets, wallet_transactions, user_sessions, connection_logs
 */

/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  await knex.schema.createTable('roles', (t) => {
    t.increments('id').primary();
    t.string('name', 50).notNullable().unique();
  });

  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('xyz_id', 64).unique(); // id interno XYZworld
    t.bigint('tg_id').unique();
    t.string('username', 64);
    t.string('display_name', 128);
    t.string('email', 128).unique();
    t.string('phone', 32);
    t.string('avatar_url');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());
    t.timestamp('first_seen_at');
    t.timestamp('last_seen_at');
  });

  await knex.schema.createTable('auth_identities', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('provider', 32).notNullable(); // 'telegram' | 'password'
    t.string('provider_uid', 128).notNullable(); // tg_id o email/username
    t.string('password_hash'); // si provider='password'
    t.jsonb('meta');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.unique(['provider', 'provider_uid']);
    t.index(['user_id']);
  });

  await knex.schema.createTable('user_roles', (t) => {
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.integer('role_id').notNullable().references('id').inTable('roles').onDelete('CASCADE');
    t.primary(['user_id', 'role_id']);
  });

  await knex.schema.createTable('wallets', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().unique().references('id').inTable('users').onDelete('CASCADE');
    t.decimal('fires_balance', 18, 2).notNullable().defaultTo(0);
    t.decimal('coins_balance', 18, 2).notNullable().defaultTo(0);
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('wallet_transactions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('wallet_id').notNullable().references('id').inTable('wallets').onDelete('CASCADE');
    t.string('type', 32).notNullable(); // raffle_buy, reward, refund, deposit, withdraw
    t.decimal('amount_fire', 18, 2).defaultTo(0);
    t.decimal('amount_coin', 18, 2).defaultTo(0);
    t.text('reference');
    t.jsonb('meta');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.index(['wallet_id', 'created_at']);
  });

  await knex.schema.createTable('user_sessions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('expires_at');
    t.string('ip', 64);
    t.text('ua');
    t.jsonb('data');
    t.index(['user_id', 'created_at']);
  });

  await knex.schema.createTable('connection_logs', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id').references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('ts').defaultTo(knex.fn.now());
    t.text('ua');
    t.string('platform', 64);
    t.string('ip', 64);
    t.jsonb('meta');
    t.index(['user_id', 'ts']);
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('connection_logs');
  await knex.schema.dropTableIfExists('user_sessions');
  await knex.schema.dropTableIfExists('wallet_transactions');
  await knex.schema.dropTableIfExists('wallets');
  await knex.schema.dropTableIfExists('user_roles');
  await knex.schema.dropTableIfExists('auth_identities');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('roles');
};
