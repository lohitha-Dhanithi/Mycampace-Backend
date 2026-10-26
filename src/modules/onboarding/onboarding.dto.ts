import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'

export class OrganizationSetupDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string

  /** Sent by the web app as a suggestion. The server always generates the unique organization code itself. */
  @ApiPropertyOptional({ description: 'Ignored: the server generates the organization code' })
  @IsOptional()
  @IsString()
  code?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  legalName?: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  type: string

  @ApiProperty({ default: 'India' })
  @IsString()
  country: string

  @ApiProperty()
  @IsString()
  state: string

  @ApiProperty()
  @IsString()
  city: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postalCode?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  domains?: string[]

  @ApiPropertyOptional()
  @IsOptional()
  branding?: Record<string, unknown>

  @ApiPropertyOptional()
  @IsOptional()
  primaryContact?: Record<string, unknown>
}

export class InstitutionInputDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string

  @ApiProperty()
  @IsString()
  name: string

  @ApiProperty()
  @IsString()
  code: string

  @ApiProperty()
  @IsString()
  type: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  affiliation?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string
}

export class CampusInputDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string

  @ApiProperty()
  @IsString()
  institutionCode: string

  @ApiProperty()
  @IsString()
  name: string

  @ApiProperty()
  @IsString()
  code: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string
}

export class InstitutionsSetupDto {
  @ApiProperty({ type: [InstitutionInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InstitutionInputDto)
  institutions: InstitutionInputDto[]

  @ApiProperty({ type: [CampusInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CampusInputDto)
  campuses: CampusInputDto[]
}

export class ProductSelectionDto {
  @ApiProperty({ example: ['academics', 'lms', 'finance'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  productIds: string[]
}

export class TeamInviteInputDto {
  @ApiProperty()
  @IsEmail()
  email: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jobTitle?: string

  @ApiPropertyOptional()
  @IsOptional()
  productRoles?: Record<string, string>
}

export class TeamInviteDto {
  @ApiProperty({ type: [TeamInviteInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeamInviteInputDto)
  invites: TeamInviteInputDto[]
}
