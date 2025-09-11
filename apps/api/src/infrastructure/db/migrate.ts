import { migrate } from 'drizzle-orm/postgres-js/migrator'

import { db } from './index'

async function main() {
  try {
    await migrate(db, { migrationsFolder: './migrations' })
    console.log('Migrations completed!')
    process.exit(0)
  } catch (error) {
    console.error('Error during migration:', error)
    process.exit(1)
  }
}

main()
