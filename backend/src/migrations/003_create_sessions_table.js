// Migration: Create sessions table
exports.up = function(knex) {
  return knex.schema.createTable('sessions', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('clientId').notNullable();
    table.uuid('nodeId').references('id').inTable('nodes').onDelete('CASCADE');
    table.timestamp('startTime').notNullable();
    table.timestamp('endTime').nullable();
    table.bigInteger('bytesTransferred').defaultTo(0);
    table.boolean('isActive').defaultTo(true);
    table.jsonb('route').nullable();
    table.timestamps(true, true);
    
    table.index(['clientId']);
    table.index(['nodeId']);
    table.index(['isActive']);
    table.index(['startTime']);
    table.index(['endTime']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('sessions');
};
