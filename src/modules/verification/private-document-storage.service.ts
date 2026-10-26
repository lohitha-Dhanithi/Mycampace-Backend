import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'crypto'
import { mkdir, readFile, unlink, writeFile } from 'fs/promises'
import { dirname, join, resolve, sep } from 'path'

/**
 * Private storage for verification documents.
 * - Files are never served statically; they are only read by authenticated, authorised endpoints.
 * - Object keys are random; user-supplied names never reach the filesystem.
 * Production should replace this adapter with a private S3 bucket (not implemented in this repo yet).
 */
@Injectable()
export class PrivateDocumentStorage {
  private readonly logger = new Logger(PrivateDocumentStorage.name)
  private readonly root: string

  constructor(config: ConfigService) {
    this.root = resolve(
      config.get<string>('PRIVATE_DOCUMENT_ROOT') ??
        join(config.get<string>('LOCAL_STORAGE_ROOT', join(process.cwd(), 'storage')), 'private-documents'),
    )
  }

  private pathFor(key: string) {
    const full = resolve(this.root, key)
    // Defence in depth against path traversal in a tampered key.
    if (!full.startsWith(this.root + sep)) throw new Error('Invalid storage key')
    return full
  }

  async put(organizationId: string, body: Buffer, ext: string): Promise<string> {
    const key = `${organizationId}/${randomUUID()}.${ext}`
    const full = this.pathFor(key)
    await mkdir(dirname(full), { recursive: true })
    await writeFile(full, body, { flag: 'wx' })
    return key
  }

  read(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key))
  }

  async remove(key: string): Promise<void> {
    try {
      await unlink(this.pathFor(key))
    } catch (e: any) {
      if (e?.code !== 'ENOENT') this.logger.warn(`Could not delete stored document: ${e?.message}`)
    }
  }
}
