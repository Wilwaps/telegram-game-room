/** @param {import('knex').Knex} knex */
exports.up = async function up(knex){
  await knex.schema.createTable('supply_txs', (t)=>{
    t.bigIncrements('id').primary();
    t.timestamp('ts').notNullable().defaultTo(knex.fn.now());
    t.string('type', 32).notNullable();
    t.decimal('amount', 24, 2).notNullable().defaultTo(0);
    t.string('user_ext', 120);
    t.integer('user_id');
    t.integer('event_id').references('id').inTable('welcome_events').onDelete('SET NULL');
    t.string('reference', 120);
    t.jsonb('meta');
    t.string('actor', 120);
  });
  await knex.schema.alterTable('supply_txs', (t)=>{
    t.index(['ts']);
    t.index(['type']);
    t.index(['event_id']);
    t.index(['user_ext']);
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex){
  await knex.schema.dropTableIfExists('supply_txs');
};
