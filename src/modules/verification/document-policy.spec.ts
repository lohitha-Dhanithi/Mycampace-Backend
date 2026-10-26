import { DOCUMENT_CATALOG, deriveContext } from './document-policy'
import { EXTENSION, pdfHasActiveContent, sanitizeFilename, sniffFormat } from './file-validation'

const ctx = (over: Partial<Parameters<typeof deriveContext>[0]> = {}) =>
  deriveContext({ orgType: 'School', institutionTypes: [], institutionAffiliations: [], financeEnabled: false, campusCount: 1, ...over })

const required = (key: string, c: ReturnType<typeof ctx>) => DOCUMENT_CATALOG.find((d) => d.key === key)!.rule(c)[0]

describe('document catalog', () => {
  it('covers all 20 documents exactly once, numbered 1-20', () => {
    expect(DOCUMENT_CATALOG.map((d) => d.number).sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
    expect(new Set(DOCUMENT_CATALOG.map((d) => d.key)).size).toBe(20)
  })

  it('gives every upload a format allow-list and a positive size limit; logo is image-only', () => {
    for (const d of DOCUMENT_CATALOG.filter((x) => x.kind !== 'data')) {
      expect(d.formats.length).toBeGreaterThan(0)
      expect(d.maxBytes).toBeGreaterThan(0)
    }
    expect(DOCUMENT_CATALOG.find((d) => d.key === 'logo')!.formats).not.toContain('pdf')
  })
})

describe('requirement rules (decided by the backend)', () => {
  it('always requires the core identity, PAN, address, authorisation and logo documents', () => {
    const c = ctx()
    for (const k of ['registration_certificate', 'legal_entity_certificate', 'recognition_certificate', 'pan_card', 'address_proof', 'authorisation_letter', 'logo']) {
      expect(required(k, c)).toBe(true)
    }
  })

  it('keeps GST, TAN, resolution, letterhead and safety certificates optional', () => {
    const c = ctx()
    for (const k of ['gst_certificate', 'tan_certificate', 'board_resolution', 'letterhead', 'fire_safety', 'building_safety', 'regulatory_approval']) {
      expect(required(k, c)).toBe(false)
    }
  })

  it('requires board affiliation for schools only', () => {
    expect(required('board_affiliation', ctx({ institutionTypes: ['K-12 School'] }))).toBe(true)
    expect(required('board_affiliation', ctx({ orgType: 'University', institutionTypes: ['Higher Ed'] }))).toBe(false)
  })

  it('requires university affiliation and course approvals for higher-ed', () => {
    const c = ctx({ orgType: 'College', institutionTypes: ['Higher Ed'], institutionAffiliations: ['UGC'] })
    expect(required('university_affiliation', c)).toBe(true)
    expect(required('course_approval', c)).toBe(true)
    expect(required('university_affiliation', ctx())).toBe(false)
  })

  it('requires bank proof only when the Finance product is enabled', () => {
    expect(required('bank_proof', ctx({ financeEnabled: true }))).toBe(true)
    expect(required('bank_proof', ctx({ financeEnabled: false }))).toBe(false)
  })

  it('requires campus address proofs only with more than one campus', () => {
    expect(required('campus_address_proof', ctx({ campusCount: 3 }))).toBe(true)
    expect(required('campus_address_proof', ctx({ campusCount: 1 }))).toBe(false)
  })
})

describe('file validation', () => {
  const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj')
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0])
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10])

  it('identifies real formats from their signature', () => {
    expect(sniffFormat(pdf)).toBe('pdf')
    expect(sniffFormat(png)).toBe('png')
    expect(sniffFormat(jpg)).toBe('jpg')
  })

  it('rejects executables, scripts, SVG and empty files regardless of name', () => {
    expect(sniffFormat(Buffer.from('MZ\x90\x00 this is an exe renamed .pdf'))).toBeNull()
    expect(sniffFormat(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull()
    expect(sniffFormat(Buffer.from('<?php echo 1; ?>'))).toBeNull()
    expect(sniffFormat(Buffer.alloc(0))).toBeNull()
  })

  it('flags PDFs with JavaScript / Launch actions', () => {
    expect(pdfHasActiveContent(Buffer.from('%PDF-1.4 /OpenAction << /S /JavaScript /JS (app.alert(1)) >>'))).toBe(true)
    expect(pdfHasActiveContent(Buffer.from('%PDF-1.4 /Type /Page /Launch'))).toBe(true)
    expect(pdfHasActiveContent(pdf)).toBe(false)
  })

  it('sanitizes filenames: no paths, control chars or leading dots', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd')
    expect(sanitizeFilename('C:\\Users\\a\\pan<card>.pdf')).toBe('pancard.pdf')
    expect(sanitizeFilename('.hidden\u0000.pdf')).toBe('hidden.pdf')
    expect(sanitizeFilename(undefined)).toBe('document')
    expect(sanitizeFilename('x'.repeat(500)).length).toBe(120)
  })

  it('maps formats to safe stored extensions', () => {
    expect(EXTENSION).toEqual({ pdf: 'pdf', jpg: 'jpg', png: 'png' })
  })
})
