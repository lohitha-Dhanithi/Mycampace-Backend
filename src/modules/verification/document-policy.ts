// Server-side document requirement policy for institution verification.
// The backend decides what is required; the frontend only renders this result.

export type DocFormat = 'pdf' | 'jpg' | 'png'

export const FORMAT_MIME: Record<DocFormat, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  png: 'image/png',
}

const MB = 1024 * 1024

export type DocGroup =
  | 'Registration & legal identity'
  | 'Recognition & affiliation'
  | 'Tax & financial registration'
  | 'Address & campuses'
  | 'Authorised management & signatory'
  | 'Branding & official communication'
  | 'Building & safety compliance'

export interface PolicyContext {
  /** any institution (or the organisation type) is a school */
  hasSchool: boolean
  /** any institution is a college / university / higher-ed */
  hasHigherEd: boolean
  /** finance product is active, so a bank proof is needed */
  financeEnabled: boolean
  campusCount: number
}

export interface DocDefinition {
  key: string
  /** number in the product's document list (1-20) */
  number: number
  label: string
  group: DocGroup
  description: string
  formats: DocFormat[]
  maxBytes: number
  /** one upload slot per campus instead of one per organisation */
  perCampus?: boolean
  /** not an upload: captured as structured data during onboarding */
  kind?: 'upload' | 'data'
  /** returns [required, human readable reason] */
  rule: (ctx: PolicyContext) => [boolean, string]
}

const ALL: DocFormat[] = ['pdf', 'jpg', 'png']
const always = (): [boolean, string] => [true, 'Required for every institution']
const optional = (why: string) => (): [boolean, string] => [false, why]

export const DOCUMENT_CATALOG: DocDefinition[] = [
  {
    key: 'registration_certificate',
    number: 1,
    label: 'Institution Registration / Establishment Certificate',
    group: 'Registration & legal identity',
    description: 'Certificate issued when the institution was registered or established.',
    formats: ALL,
    maxBytes: 5 * MB,
    rule: always,
  },
  {
    key: 'legal_entity_certificate',
    number: 2,
    label: 'Trust Deed / Society Registration / Company Incorporation Certificate',
    group: 'Registration & legal identity',
    description: 'Whichever applies to your legal structure. Multi-page deeds should be a single PDF.',
    formats: ['pdf', 'jpg', 'png'],
    maxBytes: 10 * MB,
    rule: always,
  },
  {
    key: 'recognition_certificate',
    number: 3,
    label: 'Institution Recognition Certificate',
    group: 'Recognition & affiliation',
    description: 'Recognition granted by the competent government or regulatory authority.',
    formats: ALL,
    maxBytes: 5 * MB,
    rule: always,
  },
  {
    key: 'board_affiliation',
    number: 4,
    label: 'Board Affiliation Certificate (CBSE / ICSE / State Board)',
    group: 'Recognition & affiliation',
    description: 'Affiliation letter or certificate from the education board.',
    formats: ALL,
    maxBytes: 5 * MB,
    rule: (c) => (c.hasSchool ? [true, 'Required because you registered a school'] : [false, 'Only if you run a board-affiliated school']),
  },
  {
    key: 'university_affiliation',
    number: 5,
    label: 'University Affiliation Certificate',
    group: 'Recognition & affiliation',
    description: 'Affiliation to a university or autonomous-status order.',
    formats: ALL,
    maxBytes: 5 * MB,
    rule: (c) =>
      c.hasHigherEd ? [true, 'Required because you registered a college / university'] : [false, 'Only if you run a college affiliated to a university'],
  },
  {
    key: 'regulatory_approval',
    number: 6,
    label: 'Regulatory Approval / Accreditation Certificate',
    group: 'Recognition & affiliation',
    description: 'UGC, AICTE, NAAC, NBA or any other regulator approval or accreditation.',
    formats: ALL,
    maxBytes: 5 * MB,
    rule: optional('Where applicable'),
  },
  {
    key: 'course_approval',
    number: 18,
    label: 'Course / Programme Approval Documents',
    group: 'Recognition & affiliation',
    description: 'Approvals for regulated programmes. Combine several approvals into one PDF.',
    formats: ['pdf', 'jpg', 'png'],
    maxBytes: 10 * MB,
    rule: (c) =>
      c.hasHigherEd ? [true, 'Required because you registered a college / university'] : [false, 'Where applicable'],
  },
  {
    key: 'pan_card',
    number: 7,
    label: 'Institution PAN Card',
    group: 'Tax & financial registration',
    description: 'PAN card of the institution (not of an individual).',
    formats: ALL,
    maxBytes: 2 * MB,
    rule: always,
  },
  {
    key: 'gst_certificate',
    number: 8,
    label: 'GST Registration Certificate',
    group: 'Tax & financial registration',
    description: 'Upload if the institution is registered under GST.',
    formats: ['pdf', 'jpg', 'png'],
    maxBytes: 2 * MB,
    rule: optional('Only if GST registered'),
  },
  {
    key: 'tan_certificate',
    number: 9,
    label: 'TAN Certificate',
    group: 'Tax & financial registration',
    description: 'Upload if the institution has a TAN.',
    formats: ALL,
    maxBytes: 2 * MB,
    rule: optional('Only if applicable'),
  },
  {
    key: 'bank_proof',
    number: 14,
    label: 'Institution Bank Account Proof / Cancelled Cheque',
    group: 'Tax & financial registration',
    description: 'Cancelled cheque or bank letter showing the institution account name and number.',
    formats: ALL,
    maxBytes: 2 * MB,
    rule: (c) =>
      c.financeEnabled ? [true, 'Required because the Finance product is enabled'] : [false, 'Needed only if financial services are enabled'],
  },
  {
    key: 'address_proof',
    number: 10,
    label: 'Institution Address Proof',
    group: 'Address & campuses',
    description: 'Utility bill, property tax receipt or lease agreement for the registered address.',
    formats: ALL,
    maxBytes: 5 * MB,
    rule: always,
  },
  {
    key: 'campus_address_proof',
    number: 11,
    label: 'Campus Address Proof',
    group: 'Address & campuses',
    description: 'One proof for each campus.',
    formats: ALL,
    maxBytes: 5 * MB,
    perCampus: true,
    rule: (c) =>
      c.campusCount > 1 ? [true, 'Required for each campus because you have multiple campuses'] : [false, 'Needed only with multiple campuses'],
  },
  {
    key: 'authorisation_letter',
    number: 12,
    label: 'Authorised Signatory Appointment / Authorisation Letter',
    group: 'Authorised management & signatory',
    description: 'Letter authorising the person completing this registration to act for the institution.',
    formats: ALL,
    maxBytes: 5 * MB,
    rule: always,
  },
  {
    key: 'board_resolution',
    number: 13,
    label: 'Board Resolution / Management Authorisation',
    group: 'Authorised management & signatory',
    description: 'Resolution passed by the governing body, where your structure requires one.',
    formats: ALL,
    maxBytes: 5 * MB,
    rule: optional('Where applicable'),
  },
  {
    key: 'logo',
    number: 15,
    label: 'Institution Logo',
    group: 'Branding & official communication',
    description: 'Square PNG or JPG, at least 256 × 256 px.',
    formats: ['png', 'jpg'],
    maxBytes: 2 * MB,
    rule: always,
  },
  {
    key: 'letterhead',
    number: 16,
    label: 'Official Letterhead',
    group: 'Branding & official communication',
    description: 'A blank sample of the institution letterhead.',
    formats: ALL,
    maxBytes: 5 * MB,
    rule: optional('If required for official communication'),
  },
  // {
  //   key: 'contact_verification',
  //   number: 17,
  //   label: 'Institution Contact Details & Official Email Verification',
  //   group: 'Branding & official communication',
  //   description: 'Captured as structured data in Step 1 (organisation contact), not uploaded as a file.',
  //   formats: [],
  //   maxBytes: 0,
  //   kind: 'data',
  //   rule: always,
  // },
  {
    key: 'fire_safety',
    number: 19,
    label: 'School Safety / Fire Safety Certificate',
    group: 'Building & safety compliance',
    description: 'Current fire-safety or school-safety certificate.',
    formats: ALL,
    maxBytes: 5 * MB,
    rule: optional('Where applicable'),
  },
  {
    key: 'building_safety',
    number: 20,
    label: 'Building Occupancy / Building Safety Certificate',
    group: 'Building & safety compliance',
    description: 'Occupancy or structural-safety certificate for the premises.',
    formats: ALL,
    maxBytes: 5 * MB,
    rule: optional('Where applicable'),
  },
]

export const DOC_BY_KEY = new Map(DOCUMENT_CATALOG.map((d) => [d.key, d]))

/** Hard ceiling for the multipart parser; per-document limits are enforced after parsing. */
export const MAX_UPLOAD_BYTES = Math.max(...DOCUMENT_CATALOG.map((d) => d.maxBytes))

export function deriveContext(input: {
  orgType: string
  institutionTypes: string[]
  institutionAffiliations: string[]
  financeEnabled: boolean
  campusCount: number
}): PolicyContext {
  const labels = [input.orgType, ...input.institutionTypes, ...input.institutionAffiliations].join(' ').toLowerCase()
  const hasSchool = /school|k-?12|cbse|icse|igcse|\bib\b|state board/.test(labels)
  const hasHigherEd = /college|universit|higher|ugc|aicte|degree|polytechnic/.test(labels)
  return { hasSchool, hasHigherEd, financeEnabled: input.financeEnabled, campusCount: input.campusCount }
}
