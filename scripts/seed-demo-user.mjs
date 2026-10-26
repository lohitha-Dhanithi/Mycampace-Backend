import { PrismaClient, OnboardingStatus, PlatformRole, VerificationStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function seed() {
  const email = 'vikram.aditya@abcschool.edu.in'
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`User ${email} already exists.`)
    return
  }

  const passwordHash = await bcrypt.hash('Password@123', 12)

  const org = await prisma.organization.create({
    data: {
      name: 'ABC International School',
      legalName: 'ABC International Educational Trust',
      code: 'ABC-EDU-01',
      type: 'School',
      country: 'India',
      state: 'Karnataka',
      city: 'Bangalore',
      onboardingStatus: OnboardingStatus.Completed,
      onboardingStep: 5,
      verificationStatus: VerificationStatus.Approved,
      applicationId: 'MC-2026-DEMO01',
      entitlements: {
        create: [
          { productId: 'academics', status: 'Active', tier: 'Enterprise' },
          { productId: 'lms', status: 'Active', tier: 'Enterprise' },
          { productId: 'finance', status: 'Active', tier: 'Enterprise' },
          { productId: 'admissions', status: 'Active', tier: 'Enterprise' },
          { productId: 'hrms', status: 'Active', tier: 'Enterprise' },
        ],
      },
    },
  })

  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      email,
      name: 'Vikram Aditya',
      passwordHash,
      platformRole: PlatformRole.OrganizationAdmin,
      authProvider: 'email',
      productRoles: {
        create: [
          { productId: 'academics', roleName: 'Academic Director' },
          { productId: 'lms', roleName: 'Administrator' },
          { productId: 'finance', roleName: 'Finance Controller' },
          { productId: 'admissions', roleName: 'Head of Admissions' },
          { productId: 'hrms', roleName: 'HR Administrator' },
        ],
      },
    },
  })

  console.log(`Demo user created: ${user.email} (Organization: ${org.name})`)
}

seed()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
