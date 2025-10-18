/** Seed roles admin/sponsor/client */

/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  await knex.raw(`
    INSERT INTO roles(name) VALUES
      ('admin'),
      ('sponsor'),
      ('client')
    ON CONFLICT (name) DO NOTHING
  `);
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex('roles').whereIn('name', ['admin','sponsor','client']).del();
};
