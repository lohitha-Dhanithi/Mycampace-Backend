import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export enum AcademicYearStatusDto {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export class CreateAcademicYearDto {
  @ApiProperty()
  @IsUUID()
  institutionId!: string;

  @ApiProperty({ example: '2026-27' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ example: '2026-06-01' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2027-03-31' })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ enum: AcademicYearStatusDto })
  @IsOptional()
  @IsEnum(AcademicYearStatusDto)
  status?: AcademicYearStatusDto;
}

export class UpdateAcademicYearDto extends PartialType(CreateAcademicYearDto) {}

export class AcademicYearResponseDto {
  id!: string;
  tenantId!: string;
  institutionId!: string;
  code!: string;
  name?: string | null;
  startDate!: string;
  endDate!: string;
  status!: string;
  institutionName?: string;
  institutionCode?: string;
  location?: string | null;
  createdAt!: string;
  updatedAt!: string;
}
