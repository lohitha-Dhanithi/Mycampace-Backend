import { PGlite } from '@electric-sql/pglite'
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const backendRoot = join(__dirname, '..')
const dataDir = join(backendRoot, '.pgdata')
const migrationPath = join(backendRoot, 'prisma', 'migrations', '0_init', 'migration.sql')
const markerPath = join(dataDir, '.schema_initialized')

mkdirSync(dataDir, { recursive: true })

if (existsSync(markerPath)) {
  console.log('PGlite schema already initialized at', dataDir)
  process.exit(0)
}

if (!existsSync(migrationPath)) {
  console.error('Missing migration SQL:', migrationPath)
  process.exit(1)
}

const sql = readFileSync(migrationPath, 'utf8')
console.log('Applying schema to PGlite at', dataDir)
const db = new PGlite(dataDir)
await db.exec(sql)
await db.close()

writeFileSync(markerPath, new Date().toISOString())
console.log('PGlite ready.')
