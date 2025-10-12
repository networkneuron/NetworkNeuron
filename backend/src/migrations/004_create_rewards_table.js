// Migration: Create rewards table
exports.up = function(knex) {
  return knex.schema.createTable('rewards', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('nodeId').references('id').inTable('nodes').onDelete('CASCADE');
    table.decimal('amount', 15, 2).notNullable();
    table.enum('period', ['hourly', 'daily', 'weekly', 'monthly']).notNullable();
    table.bigInteger('bandwidthProvided').defaultTo(0);
    table.integer('sessionsServed').defaultTo(0);
    table.timestamp('timestamp').notNullable();
    table.boolean('claimed').defaultTo(false);
    table.timestamp('claimedAt').nullable();
    table.timestamps(true, true);
    
    table.index(['nodeId']);
    table.index(['period']);
    table.index(['claimed']);
    table.index(['timestamp']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('rewards');
};
