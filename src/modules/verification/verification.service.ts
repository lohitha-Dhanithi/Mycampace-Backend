import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from '@nestjs/common'
import { createHash, randomInt } from 'crypto'
import { ConfigService } from '@nestjs/config'
import { MailService } from '@/common/mail/mail.service'
import { approvalMail, declineMail } from './verification-emails'
import {
  DocumentReviewStatus,
  OnboardingStatus,
  Prisma,
  VerificationStatus,
} from '@prisma/client'
import { PrismaService } from '@/prisma/prisma.service'
import { AuthenticatedUser } from '@/common/auth/current-user.decorator'
import {
  DOCUMENT_CATALOG,
  DOC_BY_KEY,
  FORMAT_MIME,
  deriveContext,
  type DocDefinition,
} from './document-policy'
import { EXTENSION, pdfHasActiveContent, sanitizeFilename, sniffFormat } from './file-validation'
import { PrivateDocumentStorage } from './private-document-storage.service'

const EDITABLE: VerificationStatus[] = [VerificationStatus.Draft, VerificationStatus.Rejected]

// No 0/O/1/I so the ID can be read out over the phone.
const APPLICATION_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function generateApplicationId() {
  const suffix = Array.from({ length: 6 }, () => APPLICATION_ID_ALPHABET[randomInt(APPLICATION_ID_ALPHABET.length)]).join('')
  return `MC-${new Date().getFullYear()}-${suffix}`
}

type OrgWithRelations = Prisma.OrganizationGetPayload<{
  include: {
    documents: true
    entitlements: true
    institutions: { include: { campuses: true } }
  }
}>

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: PrivateDocumentStorage,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  // ---------------------------------------------------------------- helpers

  private async audit(organizationId: string, userId: string | null, action: string, details: string) {
    await this.prisma.auditLog.create({
      data: { organizationId, userId, action, product: 'platform', details },
    })
  }

  private async loadOrg(organizationId: string): Promise<OrgWithRelations> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        documents: { orderBy: { createdAt: 'desc' } },
        entitlements: true,
        institutions: { include: { campuses: true } },
      },
    })
    if (!org) throw new NotFoundException('Organization not found.')
    return org
  }

  private requireOrgAdmin(user: AuthenticatedUser) {
    if (user.platformRole !== 'OrganizationAdmin') {
      throw new ForbiddenException('Only the organization administrator can manage verification documents.')
    }
  }

  private docView(d: { id: string; originalName: string; mimeType: string; sizeBytes: number; createdAt: Date; reviewStatus: DocumentReviewStatus; reviewNote: string | null }) {
    return {
      id: d.id,
      originalName: d.originalName,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      uploadedAt: d.createdAt,
      reviewStatus: d.reviewStatus,
      reviewNote: d.reviewNote,
    }
  }

  /** The single source of truth for what must be uploaded. */
  private buildRequirements(org: OrgWithRelations) {
    const campuses = org.institutions.flatMap((i) => i.campuses.map((c) => ({ id: c.id, name: c.name, institution: i.name })))
    const ctx = deriveContext({
      orgType: org.type,
      institutionTypes: org.institutions.map((i) => i.type),
      institutionAffiliations: org.institutions.map((i) => i.affiliation ?? ''),
      financeEnabled: org.entitlements.some((e) => e.productId === 'finance' && ['Active', 'Trial'].includes(e.status)),
      campusCount: campuses.length,
    })

    const contact = (org.primaryContact ?? {}) as { email?: string }

    type Slot = { def: DocDefinition; campus?: { id: string; name: string } }
    const slots: Slot[] = []
    for (const def of DOCUMENT_CATALOG) {
      if (def.perCampus) {
        if (campuses.length > 1) campuses.forEach((c) => slots.push({ def, campus: { id: c.id, name: c.name } }))
      } else {
        slots.push({ def })
      }
    }

    const items = slots.map(({ def, campus }) => {
      const [required, reason] = def.rule(ctx)
      const doc = def.kind === 'data' ? null : org.documents.find((d) => d.docType === def.key && (d.campusId ?? null) === (campus?.id ?? null)) ?? null
      const done = def.kind === 'data' ? !!contact.email : !!doc
      return {
        key: def.key,
        number: def.number,
        label: campus ? `${def.label} — ${campus.name}` : def.label,
        group: def.group,
        description: def.description,
        kind: def.kind ?? 'upload',
        required,
        requirementReason: reason,
        formats: def.formats.map((f) => f.toUpperCase()),
        maxBytes: def.maxBytes,
        campusId: campus?.id ?? null,
        campusName: campus?.name ?? null,
        document: doc ? this.docView(doc) : null,
        done,
      }
    })

    const required = items.filter((i) => i.required)
    const missing = required.filter((i) => !i.done)
    const rejected = items.filter((i) => i.document?.reviewStatus === DocumentReviewStatus.Rejected)
    return {
      items,
      summary: {
        requiredTotal: required.length,
        requiredDone: required.length - missing.length,
        optionalTotal: items.length - required.length,
        optionalDone: items.filter((i) => !i.required && i.done).length,
        missing: missing.map((m) => ({ key: m.key, campusId: m.campusId, label: m.label })),
        rejected: rejected.map((r) => ({ key: r.key, campusId: r.campusId, label: r.label, note: r.document?.reviewNote ?? null })),
      },
    }
  }

  private statusView(org: OrgWithRelations | (Pick<OrgWithRelations, 'verificationStatus' | 'verificationSubmittedAt' | 'verificationReviewedAt' | 'verificationNote' | 'verificationRound' | 'onboardingStep' | 'applicationId'>)) {
    return {
      applicationId: org.applicationId ?? null,
      status: org.verificationStatus,
      submittedAt: org.verificationSubmittedAt,
      reviewedAt: org.verificationReviewedAt,
      note: org.verificationNote,
      round: org.verificationRound,
      editable: EDITABLE.includes(org.verificationStatus),
      onboardingStep: org.onboardingStep,
    }
  }

  // ------------------------------------------------------- applicant API

  async getStatus(organizationId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } })
    if (!org) throw new NotFoundException('Organization not found.')
    return this.statusView(org)
  }

  async getRequirements(organizationId: string) {
    const org = await this.loadOrg(organizationId)
    const reqs = this.buildRequirements(org)
    return {
      ...reqs,
      summary: { ...reqs.summary, canSubmit: this.canSubmit(org, reqs.summary) },
      status: this.statusView(org),
    }
  }

  private canSubmit(org: OrgWithRelations, summary: { missing: unknown[]; rejected: unknown[] }) {
    return EDITABLE.includes(org.verificationStatus) && org.onboardingStep >= 4 && summary.missing.length === 0 && summary.rejected.length === 0
  }

  /** Everything the applicant entered across all steps, for the final review screen. */
  async getReviewPack(organizationId: string) {
    const org = await this.loadOrg(organizationId)
    return this.reviewPackOf(org)
  }

  private reviewPackOf(org: OrgWithRelations) {
    const reqs = this.buildRequirements(org)
    return {
      organization: {
        id: org.id,
        name: org.name,
        legalName: org.legalName,
        type: org.type,
        country: org.country,
        state: org.state,
        city: org.city,
        address: org.address,
        postalCode: org.postalCode,
        taxId: org.taxId,
        domains: org.domains,
        primaryContact: org.primaryContact,
      },
      institutions: org.institutions.map((i) => ({
        id: i.id,
        name: i.name,
        code: i.code,
        type: i.type,
        affiliation: i.affiliation,
        email: i.email,
        phone: i.phone,
        campuses: i.campuses.map((c) => ({ id: c.id, name: c.name, code: c.code, city: c.city, address: c.address })),
      })),
      products: org.entitlements.map((e) => ({ productId: e.productId, status: e.status, plan: e.plan })),
      requirements: reqs.items,
      summary: { ...reqs.summary, canSubmit: this.canSubmit(org, reqs.summary) },
      status: this.statusView(org),
    }
  }

  async uploadDocument(
    user: AuthenticatedUser,
    file: { buffer: Buffer; originalname: string; size: number } | undefined,
    docType: string,
    campusId: string | undefined,
  ) {
    this.requireOrgAdmin(user)
    if (!file?.buffer?.length) throw new BadRequestException('No file was uploaded.')

    const def = DOC_BY_KEY.get(docType)
    if (!def || def.kind === 'data') throw new BadRequestException('Unknown document type.')

    const org = await this.loadOrg(user.organizationId)
    if (!EDITABLE.includes(org.verificationStatus)) {
      throw new ConflictException('Documents are locked while the application is under review or after approval.')
    }

    // Campus association
    if (def.perCampus) {
      const campusIds = org.institutions.flatMap((i) => i.campuses.map((c) => c.id))
      if (!campusId || !campusIds.includes(campusId)) {
        throw new BadRequestException('A valid campus of your organization is required for this document.')
      }
    } else if (campusId) {
      throw new BadRequestException('This document is not specific to a campus.')
    }

    // Size, then signature, then format allow-list: all on the server.
    if (file.buffer.length > def.maxBytes) {
      throw new PayloadTooLargeException(`File is too large. Maximum for this document is ${Math.floor(def.maxBytes / 1024 / 1024)} MB.`)
    }
    const format = sniffFormat(file.buffer)
    if (!format || !def.formats.includes(format)) {
      throw new UnsupportedMediaTypeException(
        `Unsupported file type. Allowed: ${def.formats.map((f) => f.toUpperCase()).join(', ')}.`,
      )
    }
    if (format === 'pdf' && pdfHasActiveContent(file.buffer)) {
      throw new UnsupportedMediaTypeException('PDF files containing scripts or launch actions are not accepted.')
    }

    const checksum = createHash('sha256').update(file.buffer).digest('hex')
    const storageKey = await this.storage.put(user.organizationId, file.buffer, EXTENSION[format])
    const slotCampus = def.perCampus ? campusId! : null

    let replaced: { storageKey: string } | null = null
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const previous = await tx.organizationDocument.findMany({
          where: { organizationId: user.organizationId, docType, campusId: slotCampus },
        })
        if (previous.length) {
          await tx.organizationDocument.deleteMany({ where: { id: { in: previous.map((p) => p.id) } } })
          replaced = previous[0]
        }
        return tx.organizationDocument.create({
          data: {
            organizationId: user.organizationId,
            docType,
            campusId: slotCampus,
            originalName: sanitizeFilename(file.originalname),
            storageKey,
            mimeType: FORMAT_MIME[format],
            sizeBytes: file.buffer.length,
            checksum,
            uploadedById: user.userId,
          },
        })
      })
      // Only after the DB commit: drop the superseded file(s).
      if (replaced) await this.storage.remove((replaced as { storageKey: string }).storageKey)
      await this.audit(user.organizationId, user.userId, replaced ? 'verification.document.replaced' : 'verification.document.uploaded', `${docType}${slotCampus ? ` (campus ${slotCampus})` : ''}`)
      return this.docView(created)
    } catch (e) {
      await this.storage.remove(storageKey) // don't leave an orphan file behind
      throw e
    }
  }

  async deleteDocument(user: AuthenticatedUser, documentId: string) {
    this.requireOrgAdmin(user)
    const doc = await this.prisma.organizationDocument.findFirst({
      where: { id: documentId, organizationId: user.organizationId },
      include: { organization: { select: { verificationStatus: true } } },
    })
    if (!doc) throw new NotFoundException('Document not found.')
    if (!EDITABLE.includes(doc.organization.verificationStatus)) {
      throw new ConflictException('Documents are locked while the application is under review or after approval.')
    }
    await this.prisma.organizationDocument.delete({ where: { id: doc.id } })
    await this.storage.remove(doc.storageKey)
    await this.audit(user.organizationId, user.userId, 'verification.document.deleted', doc.docType)
    return { success: true }
  }

  /** Owner organisation or SuperAdmin only. Superadmin reads are audited. */
  async readDocument(user: AuthenticatedUser, documentId: string) {
    const isSuper = user.platformRole === 'SuperAdmin'
    const doc = await this.prisma.organizationDocument.findFirst({
      where: isSuper ? { id: documentId } : { id: documentId, organizationId: user.organizationId },
    })
    if (!doc) throw new NotFoundException('Document not found.') // same answer for "not yours"
    let body: Buffer
    try {
      body = await this.storage.read(doc.storageKey)
    } catch {
      throw new NotFoundException('Document file is not available.')
    }
    if (isSuper) {
      await this.audit(doc.organizationId, user.userId, 'verification.document.viewed', `${doc.docType} by superadmin`)
    }
    return { body, mimeType: doc.mimeType, filename: doc.originalName }
  }

  async submit(user: AuthenticatedUser) {
    this.requireOrgAdmin(user)
    const org = await this.loadOrg(user.organizationId)
    if (!EDITABLE.includes(org.verificationStatus)) {
      throw new ConflictException('This application has already been submitted.')
    }
    if (org.onboardingStep < 4) {
      throw new UnprocessableEntityException({ code: 'ONBOARDING_INCOMPLETE', message: 'Complete the organization, institution and product steps first.' })
    }
    const { summary } = this.buildRequirements(org)
    if (summary.missing.length) {
      throw new UnprocessableEntityException({ code: 'DOCUMENTS_MISSING', message: 'Required documents are missing.', missing: summary.missing })
    }
    if (summary.rejected.length) {
      throw new UnprocessableEntityException({ code: 'DOCUMENTS_REJECTED', message: 'Replace the documents that were rejected before resubmitting.', rejected: summary.rejected })
    }

    // The Application ID is issued once, on the first submission, and kept on resubmissions.
    // Conditional update: two concurrent submits cannot both win. A (very unlikely) ID collision is retried.
    let count = 0
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const res = await this.prisma.organization.updateMany({
          where: { id: org.id, verificationStatus: { in: EDITABLE } },
          data: {
            verificationStatus: VerificationStatus.Submitted,
            verificationSubmittedAt: new Date(),
            verificationReviewedAt: null,
            verificationReviewedById: null,
            verificationNote: null,
            verificationRound: { increment: 1 },
            onboardingStatus: OnboardingStatus.Completed,
            onboardingStep: 5,
            ...(org.applicationId ? {} : { applicationId: generateApplicationId() }),
          },
        })
        count = res.count
        break
      } catch (e) {
        const isIdCollision = (e as { code?: string }).code === 'P2002' && !org.applicationId
        if (!isIdCollision || attempt === 4) throw e
      }
    }
    if (count !== 1) throw new ConflictException('This application has already been submitted.')
    await this.audit(org.id, user.userId, 'verification.submitted', `round ${org.verificationRound + 1}`)
    return { ...(await this.getStatus(org.id)), demoReview: this.demoEnabled() }
  }

  // ------------------------------------------------------- test-only self review

  /**
   * TEST ONLY. Lets the applicant approve/decline their own submission when no superadmin exists yet.
   * Never active in production; on in NODE_ENV=development unless DEMO_SELF_APPROVAL=false, or anywhere
   * else (non-production) when DEMO_SELF_APPROVAL=true.
   */
  demoEnabled(): boolean {
    const env = this.config.get<string>('NODE_ENV')
    const flag = this.config.get<string>('DEMO_SELF_APPROVAL')
    if (env === 'production') return false
    return flag === 'true' || (env === 'development' && flag !== 'false')
  }

  async demoDecide(user: AuthenticatedUser, kind: 'approve' | 'decline') {
    this.requireOrgAdmin(user)
    if (!this.demoEnabled()) throw new NotFoundException('Not found.')
    const org = await this.prisma.organization.findUnique({ where: { id: user.organizationId } })
    if (!org) throw new NotFoundException('Organization not found.')
    if (org.verificationStatus !== VerificationStatus.Submitted) {
      throw new ConflictException('This application is not awaiting a decision.')
    }
    await this.audit(org.id, user.userId, `verification.demo.${kind}`, 'self review (test mode)')
    if (kind === 'approve') {
      // The normal approval rule needs every document accepted by a reviewer; in test mode that step is skipped.
      await this.prisma.organizationDocument.updateMany({
        where: { organizationId: org.id },
        data: { reviewStatus: DocumentReviewStatus.Accepted, reviewedById: user.userId, reviewedAt: new Date() },
      })
      return this.approve(user, org.id, org.verificationRound, 'Approved in test mode (self review).')
    }
    return this.reject(user, org.id, 'Verification failed. This application was declined in test mode.', org.verificationRound)
  }

  // ------------------------------------------------------- superadmin API

  async listApplications(q: { status?: VerificationStatus; search?: string; page: number; pageSize: number }) {
    const where: Prisma.OrganizationWhereInput = {
      verificationStatus: q.status ?? { not: VerificationStatus.Draft },
      ...(q.search
        ? { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { applicationId: { contains: q.search, mode: 'insensitive' } }] }
        : {}),
    }
    const statuses = [VerificationStatus.Submitted, VerificationStatus.Approved, VerificationStatus.Rejected]
    const [total, rows, ...counts] = await this.prisma.$transaction([
      this.prisma.organization.count({ where }),
      this.prisma.organization.findMany({
        where,
        orderBy: [{ verificationSubmittedAt: { sort: 'desc', nulls: 'last' } }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: {
          _count: { select: { documents: true } },
          users: { where: { platformRole: 'OrganizationAdmin' }, take: 1, orderBy: { createdAt: 'asc' }, select: { name: true, email: true } },
        },
      }),
      ...statuses.map((s) => this.prisma.organization.count({ where: { verificationStatus: s } })),
    ])
    return {
      total,
      page: q.page,
      pageSize: q.pageSize,
      counts: Object.fromEntries(statuses.map((s, i) => [s, counts[i]])),
      items: rows.map((o) => ({
        id: o.id,
        applicationId: o.applicationId,
        name: o.name,
        type: o.type,
        city: o.city,
        state: o.state,
        status: o.verificationStatus,
        round: o.verificationRound,
        submittedAt: o.verificationSubmittedAt,
        reviewedAt: o.verificationReviewedAt,
        documentCount: o._count.documents,
        admin: o.users[0] ?? null,
      })),
    }
  }

  async getApplication(organizationId: string) {
    const org = await this.loadOrg(organizationId)
    if (org.verificationStatus === VerificationStatus.Draft) {
      throw new NotFoundException('This organization has not submitted an application.')
    }
    const admin = await this.prisma.user.findFirst({
      where: { organizationId, platformRole: 'OrganizationAdmin' },
      orderBy: { createdAt: 'asc' },
      select: { name: true, email: true, mobile: true },
    })
    return { ...this.reviewPackOf(org), admin }
  }

  async reviewDocument(
    reviewer: AuthenticatedUser,
    organizationId: string,
    documentId: string,
    decision: 'Accepted' | 'Rejected',
    note?: string,
  ) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } })
    if (!org) throw new NotFoundException('Organization not found.')
    if (org.verificationStatus !== VerificationStatus.Submitted) {
      throw new ConflictException('Documents can only be reviewed while the application is awaiting verification.')
    }
    if (decision === 'Rejected' && !note?.trim()) {
      throw new BadRequestException('A reason is required when rejecting a document.')
    }
    const res = await this.prisma.organizationDocument.updateMany({
      where: { id: documentId, organizationId },
      data: {
        reviewStatus: decision,
        reviewNote: note?.trim() || null,
        reviewedById: reviewer.userId,
        reviewedAt: new Date(),
      },
    })
    if (res.count !== 1) throw new NotFoundException('Document not found.')
    await this.audit(organizationId, reviewer.userId, `verification.document.${decision.toLowerCase()}`, `document ${documentId}`)
    return { success: true }
  }

  async approve(reviewer: AuthenticatedUser, organizationId: string, round?: number, note?: string) {
    const org = await this.loadOrg(organizationId)
    if (org.verificationStatus !== VerificationStatus.Submitted) {
      throw new ConflictException('This application is not awaiting a decision (it may already have been decided).')
    }
    if (round !== undefined && round !== org.verificationRound) {
      throw new ConflictException('The application was resubmitted since you opened it. Reload and review the latest version.')
    }

    // Approval is only possible when every required document is present AND accepted by a reviewer.
    const { items, summary } = this.buildRequirements(org)
    const problems: string[] = []
    if (summary.missing.length) problems.push(`${summary.missing.length} required document(s) are missing`)
    const notAccepted = items.filter((i) => i.required && i.kind === 'upload' && i.document && i.document.reviewStatus !== DocumentReviewStatus.Accepted)
    if (notAccepted.length) problems.push(`${notAccepted.length} required document(s) have not been accepted`)
    if (summary.rejected.length) problems.push(`${summary.rejected.length} document(s) are rejected`)
    if (problems.length) {
      throw new UnprocessableEntityException({ code: 'APPROVAL_BLOCKED', message: `Cannot approve: ${problems.join('; ')}.`, notAccepted: notAccepted.map((n) => n.label) })
    }

    // Conditional update protects against two reviewers deciding at once.
    const res = await this.prisma.organization.updateMany({
      where: { id: organizationId, verificationStatus: VerificationStatus.Submitted, verificationRound: org.verificationRound },
      data: {
        verificationStatus: VerificationStatus.Approved,
        verificationReviewedAt: new Date(),
        verificationReviewedById: reviewer.userId,
        verificationNote: note?.trim() || null,
      },
    })
    if (res.count !== 1) throw new ConflictException('Another reviewer has already decided this application.')
    await this.audit(organizationId, reviewer.userId, 'verification.approved', `round ${org.verificationRound}`)
    const emailSent = await this.notifyDecision(org, 'approved')
    return { ...(await this.getStatus(organizationId)), emailSent }
  }

  /**
   * Emails the registered administrator AFTER the decision is saved. A mail failure is audited and reported
   * to the reviewer (emailSent=false) but never rolls back or blocks the decision.
   */
  private async notifyDecision(
    org: { id: string; name: string; applicationId: string | null; primaryContact: Prisma.JsonValue },
    kind: 'approved',
  ): Promise<boolean>
  private async notifyDecision(
    org: { id: string; name: string; applicationId: string | null; primaryContact: Prisma.JsonValue },
    kind: 'declined',
    reason: string,
  ): Promise<boolean>
  private async notifyDecision(
    org: { id: string; name: string; applicationId: string | null; primaryContact: Prisma.JsonValue },
    kind: 'approved' | 'declined',
    reason = '',
  ): Promise<boolean> {
    let sent = false
    try {
      const admin = await this.prisma.user.findFirst({
        where: { organizationId: org.id, platformRole: 'OrganizationAdmin' },
        orderBy: { createdAt: 'asc' },
        select: { name: true, email: true },
      })
      const to = admin?.email ?? (org.primaryContact as { email?: string } | null)?.email
      if (to) {
        const base = {
          to,
          recipientName: admin?.name,
          applicationId: org.applicationId ?? '—',
          institutionName: org.name,
          signInUrl: this.config.get<string>('APP_BASE_URL'),
        }
        sent = await this.mail.send(kind === 'approved' ? approvalMail(base) : declineMail({ ...base, reason }))
      }
    } catch {
      sent = false
    }
    await this.audit(org.id, null, sent ? `verification.email.${kind}.sent` : `verification.email.${kind}.failed`, org.applicationId ?? '').catch(() => undefined)
    return sent
  }

  async reject(reviewer: AuthenticatedUser, organizationId: string, reason: string, round?: number) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } })
    if (!org) throw new NotFoundException('Organization not found.')
    if (org.verificationStatus !== VerificationStatus.Submitted) {
      throw new ConflictException('This application is not awaiting a decision (it may already have been decided).')
    }
    if (round !== undefined && round !== org.verificationRound) {
      throw new ConflictException('The application was resubmitted since you opened it. Reload and review the latest version.')
    }
    const res = await this.prisma.organization.updateMany({
      where: { id: organizationId, verificationStatus: VerificationStatus.Submitted, verificationRound: org.verificationRound },
      data: {
        verificationStatus: VerificationStatus.Rejected,
        verificationReviewedAt: new Date(),
        verificationReviewedById: reviewer.userId,
        verificationNote: reason.trim(),
      },
    })
    if (res.count !== 1) throw new ConflictException('Another reviewer has already decided this application.')
    await this.audit(organizationId, reviewer.userId, 'verification.rejected', `round ${org.verificationRound}`)
    const emailSent = await this.notifyDecision(org, 'declined', reason.trim())
    return { ...(await this.getStatus(organizationId)), emailSent }
  }
}
