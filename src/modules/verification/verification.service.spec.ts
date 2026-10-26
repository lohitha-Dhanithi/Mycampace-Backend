import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from '@nestjs/common'
import { DOCUMENT_CATALOG } from './document-policy'
import { VerificationService } from './verification.service'

const PDF = Buffer.from('%PDF-1.7\n%%EOF')
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])

const admin = { userId: 'u1', organizationId: 'o1', email: 'a@b.in', platformRole: 'OrganizationAdmin' }
const superadmin = { userId: 's1', organizationId: 'plat', email: 's@b.in', platformRole: 'SuperAdmin' }

/** Required docs for a plain single-campus "School" org with no finance product. */
const REQUIRED_KEYS = ['registration_certificate', 'legal_entity_certificate', 'recognition_certificate', 'board_affiliation', 'pan_card', 'address_proof', 'authorisation_letter', 'logo']

const doc = (docType: string, over: Record<string, any> = {}) => ({
  id: `d-${docType}`,
  organizationId: 'o1',
  docType,
  campusId: null,
  originalName: `${docType}.pdf`,
  storageKey: `o1/${docType}.pdf`,
  mimeType: 'application/pdf',
  sizeBytes: 100,
  createdAt: new Date(),
  reviewStatus: 'Pending',
  reviewNote: null,
  ...over,
})

function org(over: Record<string, any> = {}) {
  return {
    id: 'o1',
    name: 'Test School',
    type: 'School',
    primaryContact: { email: 'office@test.edu' },
    onboardingStep: 4,
    verificationStatus: 'Draft',
    verificationRound: 0,
    verificationSubmittedAt: null,
    verificationReviewedAt: null,
    verificationNote: null,
    documents: [] as any[],
    entitlements: [],
    institutions: [{ id: 'i1', name: 'Test School', type: 'K-12', affiliation: 'CBSE', campuses: [{ id: 'c1', name: 'Main' }] }],
    ...over,
  }
}

function build(orgRow: any) {
  const prisma: any = {
    organization: { findUnique: jest.fn().mockResolvedValue(orgRow), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    organizationDocument: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockImplementation(async ({ data }: any) => ({ ...data, id: 'new', createdAt: new Date(), reviewStatus: 'Pending', reviewNote: null })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    user: { findFirst: jest.fn() },
    $transaction: jest.fn(async (arg: any) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg))),
  }
  const storage: any = { put: jest.fn().mockResolvedValue('o1/key.pdf'), remove: jest.fn().mockResolvedValue(undefined), read: jest.fn() }
  const mail: any = { send: jest.fn().mockResolvedValue(true) }
  const config: any = { get: jest.fn().mockReturnValue('http://localhost:3000') }
  return { service: new VerificationService(prisma, storage, mail, config), prisma, storage, mail }
}

const file = (buffer: Buffer, name = 'x.pdf') => ({ buffer, originalname: name, size: buffer.length })
const fullDocs = (status = 'Accepted') => REQUIRED_KEYS.map((k) => doc(k, { reviewStatus: status }))

describe('VerificationService.uploadDocument', () => {
  it('stores a valid PDF, records the server-detected mime type and audits it', async () => {
    const { service, prisma, storage } = build(org())
    const out: any = await service.uploadDocument(admin, file(PDF, '../../PAN card.pdf'), 'pan_card', undefined)
    expect(storage.put).toHaveBeenCalledWith('o1', PDF, 'pdf')
    expect(prisma.organizationDocument.create.mock.calls[0][0].data).toMatchObject({
      docType: 'pan_card',
      mimeType: 'application/pdf',
      originalName: 'PAN card.pdf', // path stripped
      uploadedById: 'u1',
    })
    expect(out.id).toBe('new')
    expect(prisma.auditLog.create).toHaveBeenCalled()
  })

  it('rejects non-admin users', async () => {
    const { service } = build(org())
    await expect(service.uploadDocument({ ...admin, platformRole: 'Member' }, file(PDF), 'pan_card', undefined)).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('rejects an unknown document type and the data-only item', async () => {
    const { service } = build(org())
    await expect(service.uploadDocument(admin, file(PDF), 'nope', undefined)).rejects.toBeInstanceOf(BadRequestException)
    await expect(service.uploadDocument(admin, file(PDF), 'contact_verification', undefined)).rejects.toBeInstanceOf(BadRequestException)
  })

  it('returns 413 when over the per-document limit (PAN is 2 MB)', async () => {
    const { service, storage } = build(org())
    const big = Buffer.concat([PDF, Buffer.alloc(2 * 1024 * 1024)])
    await expect(service.uploadDocument(admin, file(big), 'pan_card', undefined)).rejects.toBeInstanceOf(PayloadTooLargeException)
    expect(storage.put).not.toHaveBeenCalled()
  })

  it('returns 415 for a spoofed file (exe named .pdf) and never stores it', async () => {
    const { service, storage } = build(org())
    await expect(service.uploadDocument(admin, file(Buffer.from('MZ\x90 not a pdf'), 'pan.pdf'), 'pan_card', undefined)).rejects.toBeInstanceOf(UnsupportedMediaTypeException)
    expect(storage.put).not.toHaveBeenCalled()
  })

  it('returns 415 for a PDF logo (logo allows PNG/JPG only)', async () => {
    const { service } = build(org())
    await expect(service.uploadDocument(admin, file(PDF), 'logo', undefined)).rejects.toBeInstanceOf(UnsupportedMediaTypeException)
    await expect(service.uploadDocument(admin, file(PNG, 'logo.png'), 'logo', undefined)).resolves.toBeDefined()
  })

  it('refuses PDFs that carry JavaScript', async () => {
    const { service } = build(org())
    await expect(service.uploadDocument(admin, file(Buffer.from('%PDF-1.4 /JS (x)')), 'pan_card', undefined)).rejects.toBeInstanceOf(UnsupportedMediaTypeException)
  })

  it.each(['Submitted', 'Approved'])('is locked (409) while %s', async (status) => {
    const { service } = build(org({ verificationStatus: status }))
    await expect(service.uploadDocument(admin, file(PDF), 'pan_card', undefined)).rejects.toBeInstanceOf(ConflictException)
  })

  it('is open again after a rejection', async () => {
    const { service } = build(org({ verificationStatus: 'Rejected' }))
    await expect(service.uploadDocument(admin, file(PDF), 'pan_card', undefined)).resolves.toBeDefined()
  })

  it('requires a campus of MY organization for campus address proofs', async () => {
    const multi = org({
      institutions: [{ id: 'i1', name: 'S', type: 'K-12', affiliation: null, campuses: [{ id: 'c1', name: 'A' }, { id: 'c2', name: 'B' }] }],
    })
    const { service } = build(multi)
    await expect(service.uploadDocument(admin, file(PDF), 'campus_address_proof', undefined)).rejects.toBeInstanceOf(BadRequestException)
    await expect(service.uploadDocument(admin, file(PDF), 'campus_address_proof', 'someone-elses-campus')).rejects.toBeInstanceOf(BadRequestException)
    await expect(service.uploadDocument(admin, file(PDF), 'campus_address_proof', 'c2')).resolves.toBeDefined()
  })

  it('rejects a campusId on a non-campus document', async () => {
    const { service } = build(org())
    await expect(service.uploadDocument(admin, file(PDF), 'pan_card', 'c1')).rejects.toBeInstanceOf(BadRequestException)
  })

  it('replacing deletes the superseded file only after the DB commit, and cleans up on failure', async () => {
    const { service, prisma, storage } = build(org())
    prisma.organizationDocument.findMany.mockResolvedValue([{ id: 'old', storageKey: 'o1/old.pdf' }])
    await service.uploadDocument(admin, file(PDF), 'pan_card', undefined)
    expect(storage.remove).toHaveBeenCalledWith('o1/old.pdf')

    const failing = build(org())
    failing.prisma.organizationDocument.create.mockRejectedValue(new Error('db down'))
    await expect(failing.service.uploadDocument(admin, file(PDF), 'pan_card', undefined)).rejects.toThrow('db down')
    expect(failing.storage.remove).toHaveBeenCalledWith('o1/key.pdf') // the new orphan is removed
  })
})

describe('VerificationService.submit', () => {
  it('returns 422 listing missing required documents', async () => {
    const { service } = build(org({ documents: [doc('pan_card')] }))
    await expect(service.submit(admin)).rejects.toBeInstanceOf(UnprocessableEntityException)
    await expect(service.submit(admin)).rejects.toMatchObject({ response: expect.objectContaining({ code: 'DOCUMENTS_MISSING' }) })
  })

  it('returns 422 when earlier onboarding steps are incomplete', async () => {
    const { service } = build(org({ onboardingStep: 2, documents: fullDocs('Pending') }))
    await expect(service.submit(admin)).rejects.toMatchObject({ response: expect.objectContaining({ code: 'ONBOARDING_INCOMPLETE' }) })
  })

  it('submits when all required documents exist; optional ones are not needed', async () => {
    const { service, prisma } = build(org({ documents: fullDocs('Pending') }))
    await service.submit(admin)
    const call = prisma.organization.updateMany.mock.calls[0][0]
    expect(call.where.verificationStatus).toEqual({ in: ['Draft', 'Rejected'] })
    expect(call.data).toMatchObject({ verificationStatus: 'Submitted', onboardingStep: 5 })
  })

  it('blocks resubmission until rejected documents are replaced', async () => {
    const docs = fullDocs('Accepted')
    docs[0].reviewStatus = 'Rejected'
    const { service } = build(org({ verificationStatus: 'Rejected', documents: docs }))
    await expect(service.submit(admin)).rejects.toMatchObject({ response: expect.objectContaining({ code: 'DOCUMENTS_REJECTED' }) })
  })

  it('cannot be submitted twice (409)', async () => {
    const { service } = build(org({ verificationStatus: 'Submitted', documents: fullDocs() }))
    await expect(service.submit(admin)).rejects.toBeInstanceOf(ConflictException)
    const racing = build(org({ documents: fullDocs('Pending') }))
    racing.prisma.organization.updateMany.mockResolvedValue({ count: 0 })
    await expect(racing.service.submit(admin)).rejects.toBeInstanceOf(ConflictException)
  })
})

describe('VerificationService.approve / reject (superadmin decisions)', () => {
  const submitted = (docs = fullDocs('Accepted')) => org({ verificationStatus: 'Submitted', verificationRound: 1, documents: docs })

  it('approves when every required document is present and accepted', async () => {
    const { service, prisma } = build(submitted())
    await service.approve(superadmin, 'o1', 1)
    expect(prisma.organization.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: 'o1', verificationStatus: 'Submitted', verificationRound: 1 },
      data: { verificationStatus: 'Approved', verificationReviewedById: 's1' },
    })
  })

  it('refuses to approve while a required document is merely pending review', async () => {
    const docs = fullDocs('Accepted')
    docs[2].reviewStatus = 'Pending'
    const { service, prisma } = build(submitted(docs))
    await expect(service.approve(superadmin, 'o1', 1)).rejects.toMatchObject({ response: expect.objectContaining({ code: 'APPROVAL_BLOCKED' }) })
    expect(prisma.organization.updateMany).not.toHaveBeenCalled()
  })

  it('refuses to approve with a missing required document or any rejected document', async () => {
    const { service } = build(submitted(fullDocs('Accepted').slice(1)))
    await expect(service.approve(superadmin, 'o1', 1)).rejects.toBeInstanceOf(UnprocessableEntityException)
    const withRejected = [...fullDocs('Accepted'), doc('letterhead', { reviewStatus: 'Rejected' })]
    const b = build(submitted(withRejected))
    await expect(b.service.approve(superadmin, 'o1', 1)).rejects.toBeInstanceOf(UnprocessableEntityException)
  })

  it('only approves applications that were submitted (409 otherwise)', async () => {
    for (const status of ['Draft', 'Approved', 'Rejected']) {
      const { service } = build(org({ verificationStatus: status, documents: fullDocs() }))
      await expect(service.approve(superadmin, 'o1', 0)).rejects.toBeInstanceOf(ConflictException)
    }
  })

  it('detects a stale review (application resubmitted since it was opened)', async () => {
    const { service } = build(submitted())
    await expect(service.approve(superadmin, 'o1', 0)).rejects.toBeInstanceOf(ConflictException)
  })

  it('two reviewers cannot both win: a lost conditional update is a 409', async () => {
    const { service, prisma } = build(submitted())
    prisma.organization.updateMany.mockResolvedValue({ count: 0 })
    await expect(service.approve(superadmin, 'o1', 1)).rejects.toBeInstanceOf(ConflictException)
  })

  it('rejects with a reason the applicant will see, and records the reviewer', async () => {
    const { service, prisma } = build(submitted())
    await service.reject(superadmin, 'o1', '  PAN card is blurred, please re-upload  ', 1)
    expect(prisma.organization.updateMany.mock.calls[0][0].data).toMatchObject({
      verificationStatus: 'Rejected',
      verificationNote: 'PAN card is blurred, please re-upload',
      verificationReviewedById: 's1',
    })
  })

  it('cannot reject an application that is not awaiting a decision', async () => {
    const { service } = build(org({ verificationStatus: 'Approved' }))
    await expect(service.reject(superadmin, 'o1', 'long enough reason', 0)).rejects.toBeInstanceOf(ConflictException)
  })

  it('emails the administrator on approval with the Application ID and institution name', async () => {
    const { service, prisma, mail } = build(submitted())
    prisma.organization.findUnique.mockResolvedValue({ ...submitted(), applicationId: 'MC-2026-ABC234' })
    prisma.user.findFirst.mockResolvedValue({ name: 'Asha', email: 'asha@test.edu' })
    const res = await service.approve(superadmin, 'o1', 1)
    const msg = mail.send.mock.calls[0][0]
    expect(msg.to).toBe('asha@test.edu')
    expect(msg.text).toContain('MC-2026-ABC234')
    expect(msg.text).toContain('Test School')
    expect(res.emailSent).toBe(true)
  })

  it('emails the exact decline reason (HTML-escaped in the HTML body only)', async () => {
    const { service, prisma, mail } = build(submitted())
    prisma.organization.findUnique.mockResolvedValue({ ...submitted(), applicationId: 'MC-2026-ABC234' })
    await service.reject(superadmin, 'o1', 'PAN is <blurred> & expired', 1)
    const msg = mail.send.mock.calls[0][0]
    expect(msg.to).toBe('office@test.edu') // falls back to the primary contact when no admin user is found
    expect(msg.text).toContain('PAN is <blurred> & expired')
    expect(msg.html).toContain('PAN is &lt;blurred&gt; &amp; expired')
    expect(msg.text).toContain('MC-2026-ABC234')
  })

  it('keeps the decision when the email fails', async () => {
    const { service, prisma, mail } = build(submitted())
    mail.send.mockResolvedValue(false)
    const res = await service.approve(superadmin, 'o1', 1)
    expect(prisma.organization.updateMany).toHaveBeenCalledTimes(1)
    expect(res.emailSent).toBe(false)
    mail.send.mockRejectedValue(new Error('smtp down'))
    const again = build(submitted())
    again.mail.send.mockRejectedValue(new Error('smtp down'))
    await expect(again.service.reject(superadmin, 'o1', 'long enough reason', 1)).resolves.toMatchObject({ emailSent: false })
  })
})

describe('VerificationService Application ID', () => {
  it('issues an Application ID on first submission', async () => {
    const { service, prisma } = build(org({ documents: fullDocs('Pending') }))
    await service.submit(admin)
    expect(prisma.organization.updateMany.mock.calls[0][0].data.applicationId).toMatch(/^MC-\d{4}-[A-Z2-9]{6}$/)
  })

  it('keeps the same Application ID when resubmitting after a decline', async () => {
    const { service, prisma } = build(org({ verificationStatus: 'Rejected', applicationId: 'MC-2026-ABC234', documents: fullDocs('Pending') }))
    await service.submit(admin)
    expect(prisma.organization.updateMany.mock.calls[0][0].data).not.toHaveProperty('applicationId')
  })

  it('retries when the generated ID collides', async () => {
    const { service, prisma } = build(org({ documents: fullDocs('Pending') }))
    prisma.organization.updateMany.mockRejectedValueOnce({ code: 'P2002' }).mockResolvedValueOnce({ count: 1 })
    await service.submit(admin)
    expect(prisma.organization.updateMany).toHaveBeenCalledTimes(2)
  })
})

describe('VerificationService.reviewDocument', () => {
  it('requires a reason to reject a document', async () => {
    const { service } = build(org({ verificationStatus: 'Submitted' }))
    await expect(service.reviewDocument(superadmin, 'o1', 'd1', 'Rejected', '  ')).rejects.toBeInstanceOf(BadRequestException)
    await expect(service.reviewDocument(superadmin, 'o1', 'd1', 'Accepted')).resolves.toEqual({ success: true })
  })

  it('only works while the application is awaiting verification', async () => {
    const { service } = build(org({ verificationStatus: 'Approved' }))
    await expect(service.reviewDocument(superadmin, 'o1', 'd1', 'Accepted')).rejects.toBeInstanceOf(ConflictException)
  })
})

describe('VerificationService.readDocument (tenant isolation)', () => {
  it("scopes a normal admin's lookup to their own organization and answers 404 for others' documents", async () => {
    const { service, prisma } = build(org())
    prisma.organizationDocument.findFirst.mockResolvedValue(null)
    await expect(service.readDocument(admin, 'other-orgs-doc')).rejects.toBeInstanceOf(NotFoundException)
    expect(prisma.organizationDocument.findFirst).toHaveBeenCalledWith({ where: { id: 'other-orgs-doc', organizationId: 'o1' } })
  })

  it('lets a superadmin read any organization document, and audits it', async () => {
    const { service, prisma, storage } = build(org())
    prisma.organizationDocument.findFirst.mockResolvedValue(doc('pan_card', { organizationId: 'o9' }))
    storage.read.mockResolvedValue(PDF)
    await service.readDocument(superadmin, 'd-pan_card')
    expect(prisma.organizationDocument.findFirst).toHaveBeenCalledWith({ where: { id: 'd-pan_card' } })
    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({ organizationId: 'o9', userId: 's1', action: 'verification.document.viewed' })
  })
})

describe('requirements output', () => {
  it('splits required and optional, and reports canSubmit only when nothing required is missing', async () => {
    const empty: any = await build(org()).service.getRequirements('o1')
    expect(empty.summary.requiredTotal).toBe(REQUIRED_KEYS.length + 1) // + contact details (data item)
    expect(empty.summary.canSubmit).toBe(false)
    expect(empty.items.length).toBe(DOCUMENT_CATALOG.length - 1) // campus proof hidden for a single campus

    const full: any = await build(org({ documents: fullDocs('Pending') })).service.getRequirements('o1')
    expect(full.summary.canSubmit).toBe(true)
    expect(full.summary.optionalTotal).toBeGreaterThan(0)
  })
})
