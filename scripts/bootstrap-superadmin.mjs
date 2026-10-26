// Creates the first platform SuperAdmin from environment variables. Nothing is hardcoded.
//
//   Put your own values in backend/.env (BOOTSTRAP_SUPERADMIN_EMAIL / BOOTSTRAP_SUPERADMIN_PASSWORD),
//   or pass them for one run in PowerShell:
//     $env:SUPERADMIN_EMAIL='owner@yourcompany.com'
//     $env:SUPERADMIN_PASSWORD='<strong password>'
//     npm run superadmin:bootstrap
//
// Safe to re-run: an existing SuperAdmin is left untouched unless --reset-password is passed.
// An existing non-SuperAdmin user is never silently promoted.
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

// BOOTSTRAP_SUPERADMIN_* are the names already present in .env.example; SUPERADMIN_* override them.
const email = (process.env.SUPERADMIN_EMAIL ?? process.env.BOOTSTRAP_SUPERADMIN_EMAIL)?.trim().toLowerCase()
const password = process.env.SUPERADMIN_PASSWORD ?? process.env.BOOTSTRAP_SUPERADMIN_PASSWORD
const name = process.env.SUPERADMIN_NAME?.trim() || 'Platform Superadmin'
const resetPassword = process.argv.includes('--reset-password')

function fail(msg) {
  console.error(`✖ ${msg}`)
  process.exit(1)
}

if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail('Set BOOTSTRAP_SUPERADMIN_EMAIL (or SUPERADMIN_EMAIL) to a valid email address.')
if (!password) fail('Set BOOTSTRAP_SUPERADMIN_PASSWORD (or SUPERADMIN_PASSWORD). It is never printed.')
if (/change-?me|password123/i.test(password) || /@example\.com$/i.test(email)) {
  fail('Refusing the placeholder credentials from the .env template. Use your own real email and a strong password.')
}
const strong = password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password)
if (!strong) fail('SUPERADMIN_PASSWORD must be at least 12 characters with upper, lower, digit and symbol.')

const prisma = new PrismaClient()
try {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    if (existing.platformRole !== 'SuperAdmin') {
      fail(`${email} already exists as ${existing.platformRole}. Refusing to promote it automatically; use a different email.`)
    }
    if (!resetPassword) {
      console.log(`✔ SuperAdmin ${email} already exists. Nothing changed (use --reset-password to set a new password).`)
    } else {
      await prisma.user.update({ where: { id: existing.id }, data: { passwordHash: await bcrypt.hash(password, 12), status: 'Active' } })
      await prisma.refreshToken.updateMany({ where: { userId: existing.id, revokedAt: null }, data: { revokedAt: new Date() } })
      console.log(`✔ Password reset for ${email}; existing sessions were revoked.`)
    }
  } else {
    // A SuperAdmin still needs an owning organization row; this one is the platform's own, already Approved.
    const org =
      (await prisma.organization.findUnique({ where: { code: 'PLATFORM' } })) ??
      (await prisma.organization.create({
        data: {
          name: 'MyCampace Platform',
          code: 'PLATFORM',
          type: 'Platform',
          state: 'N/A',
          city: 'N/A',
          onboardingStatus: 'Completed',
          onboardingStep: 5,
          verificationStatus: 'Approved',
          verificationNote: 'Platform operator organization',
        },
      }))
    await prisma.user.create({
      data: {
        organizationId: org.id,
        email,
        name,
        passwordHash: await bcrypt.hash(password, 12),
        platformRole: 'SuperAdmin',
        authProvider: 'email',
        status: 'Active',
      },
    })
    console.log(`✔ SuperAdmin created: ${email}`)
  }
} finally {
  await prisma.$disconnect()
}
