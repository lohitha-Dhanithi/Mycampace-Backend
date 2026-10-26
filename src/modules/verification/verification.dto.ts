import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator'
import { VerificationStatus } from '@prisma/client'

export class UploadDocumentDto {
  @ApiProperty({ example: 'pan_card', description: 'Document key from GET /verification/requirements' })
  @IsString()
  @MaxLength(64)
  docType: string

  @ApiPropertyOptional({ description: 'Required only for per-campus documents (campus_address_proof)' })
  @IsOptional()
  @IsUUID()
  campusId?: string
}

export class ApplicationListQueryDto {
  @ApiPropertyOptional({ enum: VerificationStatus })
  @IsOptional()
  @IsEnum(VerificationStatus)
  status?: VerificationStatus

  @ApiPropertyOptional({ description: 'Organization name contains' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number
}

export class ReviewDocumentDto {
  @ApiProperty({ enum: ['Accepted', 'Rejected'] })
  @IsIn(['Accepted', 'Rejected'])
  decision: 'Accepted' | 'Rejected'

  @ApiPropertyOptional({ description: 'Mandatory when rejecting' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string
}

export class ApproveDto {
  @ApiPropertyOptional({ description: 'The submission round you reviewed; protects against reviewing a stale version' })
  @IsOptional()
  @IsInt()
  round?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string
}

export class RejectDto {
  @ApiProperty({ description: 'Shown to the applicant', minLength: 10 })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  round?: number
}
