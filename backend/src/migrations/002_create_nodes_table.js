// Migration: Create nodes table
exports.up = function(knex) {
  return knex.schema.createTable('nodes', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.string('peerId').unique().notNullable();
    table.text('publicKey').notNullable();
    table.string('multiaddr').notNullable();
    table.string('region').notNullable();
    table.enum('status', ['online', 'offline', 'maintenance']).defaultTo('offline');
    table.jsonb('bandwidth').nullable();
    table.decimal('reputation', 5, 2).defaultTo(100.00);
    table.decimal('stake', 15, 2).defaultTo(0);
    table.boolean('isActive').defaultTo(true);
    table.timestamp('lastSeen').nullable();
    table.uuid('operatorId').references('id').inTable('users').onDelete('CASCADE');
    table.timestamps(true, true);
    
    table.index(['peerId']);
    table.index(['status']);
    table.index(['region']);
    table.index(['operatorId']);
    table.index(['isActive']);
    table.index(['lastSeen']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('nodes');
};
