// Migration: Create users table
exports.up = function(knex) {
  return knex.schema.createTable('users', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('email').unique().notNullable();
    table.string('password').notNullable();
    table.string('username').unique().notNullable();
    table.string('firstName').notNullable();
    table.string('lastName').notNullable();
    table.string('avatar').nullable();
    table.enum('role', ['admin', 'operator', 'user']).defaultTo('user');
    table.boolean('isActive').defaultTo(true);
    table.timestamp('lastLogin').nullable();
    table.timestamps(true, true);
    
    table.index(['email']);
    table.index(['username']);
    table.index(['role']);
    table.index(['isActive']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('users');
};
