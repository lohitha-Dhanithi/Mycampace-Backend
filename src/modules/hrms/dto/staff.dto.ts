import { ApiProperty, ApiPropertyOptional, PartialType, PickType } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export enum StaffStatusDto {
  ACTIVE = 'ACTIVE',
  ON_LEAVE = 'ON_LEAVE',
  PROBATION = 'PROBATION',
  SEPARATED = 'SEPARATED',
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateStaffDto {
  @ApiProperty()
  @IsUUID()
  campusId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiProperty()
  @IsUUID()
  categoryId!: string;

  @ApiProperty()
  @IsUUID()
  departmentId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  designation!: string;

  @ApiPropertyOptional({ description: 'Reporting manager staff id. Omit for top of the chain (leave goes to HR).' })
  @IsOptional()
  @IsUUID()
  reportingManagerId?: string;

  @ApiProperty({ example: '2026-10-12' })
  @Matches(ISO_DATE, { message: 'joiningDate must be YYYY-MM-DD' })
  joiningDate!: string;

  @ApiPropertyOptional({ enum: StaffStatusDto })
  @IsOptional()
  @IsEnum(StaffStatusDto)
  status?: StaffStatusDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  qualification?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  experienceYears?: number;

  @ApiPropertyOptional({ description: 'Link to an existing platform user' })
  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class UpdateStaffDto extends PartialType(CreateStaffDto) {
  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @Matches(ISO_DATE, { message: 'separationDate must be YYYY-MM-DD' })
  separationDate?: string;
}

/** Self-service allowlist — staff may only change contact details. */
export class UpdateMyProfileDto extends PickType(CreateStaffDto, ['phone', 'qualification'] as const) {}

export class AddStaffDocumentDto {
  @ApiProperty({ example: 'Appointment Letter' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  type!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ description: 'Object-storage key returned by the upload endpoint' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  storageKey?: string;

  @ApiPropertyOptional({ example: '2028-03-31' })
  @IsOptional()
  @Matches(ISO_DATE, { message: 'expiryDate must be YYYY-MM-DD' })
  expiryDate?: string;
}

export enum DocumentDecisionDto {
  VERIFIED = 'VERIFIED',
  EXPIRED = 'EXPIRED',
  PENDING_REVIEW = 'PENDING_REVIEW',
}

export class UpdateDocumentStatusDto {
  @ApiProperty({ enum: DocumentDecisionDto })
  @IsEnum(DocumentDecisionDto)
  status!: DocumentDecisionDto;
}

export class AddServiceEventDto {
  @ApiProperty({ example: 'Promoted to Senior Teacher' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiProperty({ example: '2026-10-01' })
  @Matches(ISO_DATE, { message: 'date must be YYYY-MM-DD' })
  date!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  detail?: string;
}

export class AddCertificationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  issuer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(ISO_DATE, { message: 'issuedOn must be YYYY-MM-DD' })
  issuedOn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(ISO_DATE, { message: 'validUntil must be YYYY-MM-DD' })
  validUntil?: string;
}
