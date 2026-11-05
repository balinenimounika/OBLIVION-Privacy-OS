
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkMigrationStatus() {
  console.log('\n==========================================');
  console.log(' OBLIVION - DATABASE MIGRATION DIAGNOSTIC');
  console.log('==========================================\n');

  try {
    // 1. Verify database connection
    console.log('[1] Checking PostgreSQL connection...');

    await prisma.$connect();

    const databaseInfo = await prisma.$queryRaw<
      Array<{ database_name: string; current_schema: string }>
    >`
      SELECT
        current_database() AS database_name,
        current_schema() AS current_schema
    `;

    console.log('Database connection: SUCCESS');
    console.log('Database name:', databaseInfo[0]?.database_name);
    console.log('Current schema:', databaseInfo[0]?.current_schema);

    // 2. Check whether reminders table exists
    console.log('\n[2] Checking reminders table...');

    const reminderTable = await prisma.$queryRaw<
      Array<{ table_name: string }>
    >`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'reminders'
    `;

    if (reminderTable.length > 0) {
      console.log('reminders table: EXISTS');
    } else {
      console.log('reminders table: MISSING');
    }

    // 3. List all public application tables
    console.log('\n[3] Listing public database tables...');

    const tables = await prisma.$queryRaw<
      Array<{ table_name: string }>
    >`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    if (tables.length === 0) {
      console.log('No application tables found.');
    } else {
      tables.forEach((table) => {
        console.log(' -', table.table_name);
      });
    }

    // 4. Check Prisma migration history
    console.log('\n[4] Checking Prisma migration history...');

    const migrationTable = await prisma.$queryRaw<
      Array<{ exists: boolean }>
    >`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = '_prisma_migrations'
      ) AS exists
    `;

    if (migrationTable[0]?.exists) {
      const migrations = await prisma.$queryRaw<
        Array<{
          migration_name: string;
          started_at: Date;
          finished_at: Date | null;
          rolled_back_at: Date | null;
        }>
      >`
        SELECT
          migration_name,
          started_at,
          finished_at,
          rolled_back_at
        FROM public."_prisma_migrations"
        ORDER BY started_at ASC
      `;

      if (migrations.length === 0) {
        console.log('No migration records found.');
      } else {
        migrations.forEach((migration) => {
          let status = 'PENDING / INCOMPLETE';

          if (migration.rolled_back_at) {
            status = 'ROLLED BACK';
          } else if (migration.finished_at) {
            status = 'SUCCESS';
          }

          console.log(`\nMigration: ${migration.migration_name}`);
          console.log(`Status: ${status}`);
          console.log(`Started: ${migration.started_at}`);
          console.log(`Finished: ${migration.finished_at ?? 'Not completed'}`);
        });
      }
    } else {
      console.log('_prisma_migrations table: MISSING');
      console.log('Prisma migration history has not been initialized.');
    }

    // 5. Final diagnostic summary
    console.log('\n==========================================');
    console.log(' DIAGNOSTIC SUMMARY');
    console.log('==========================================');

    console.log(
      'Database connection: SUCCESS'
    );

    console.log(
      'Reminders table:',
      reminderTable.length > 0 ? 'EXISTS' : 'MISSING'
    );

    console.log(
      'Prisma migration history:',
      migrationTable[0]?.exists ? 'EXISTS' : 'MISSING'
    );

    console.log('Total public tables:', tables.length);

    console.log('\nDiagnostic completed. No database changes made.');

  } catch (error) {
    console.error('\nDATABASE DIAGNOSTIC FAILED');

    if (error instanceof Error) {
      console.error('Error:', error.message);
    } else {
      console.error(error);
    }

    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

checkMigrationStatus();
