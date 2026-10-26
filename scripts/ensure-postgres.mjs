import EmbeddedPostgres from 'embedded-postgres'
import { existsSync, writeFileSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import net from 'net'

const __dirname = dirname(fileURLToPath(import.meta.url))
const backendRoot = join(__dirname, '..')
const dataDir = join(backendRoot, '.embedded-pg')
const markerPath = join(dataDir, '.running')

const DB_USER = 'mycampace_user'
const DB_PASSWORD = 'mycampace_secure_password_2026'
const DB_NAME = 'mycampace_db'
const DB_PORT = 5432

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' }, () => {
      socket.end()
      resolve(true)
    })
    socket.on('error', () => resolve(false))
  })
}

if (await portOpen(DB_PORT)) {
  console.log(`PostgreSQL already listening on ${DB_PORT}`)
  process.exit(0)
}

console.log('Starting embedded PostgreSQL (first run may take a minute)...')
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: DB_USER,
  password: DB_PASSWORD,
  port: DB_PORT,
  persistent: true,
})

await pg.initialise()
await pg.start()

try {
  await pg.createDatabase(DB_NAME)
  console.log(`Created database ${DB_NAME}`)
} catch {
  console.log(`Database ${DB_NAME} already exists or could not be created (may be OK).`)
}

writeFileSync(markerPath, new Date().toISOString())
console.log(`Embedded PostgreSQL ready on port ${DB_PORT}`)
process.exit(0)
