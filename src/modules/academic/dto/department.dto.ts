import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export enum DepartmentStatusDto {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export class CreateDepartmentDto {
  @ApiProperty()
  @IsUUID()
  institutionId!: string;

  @ApiProperty({ example: 'CS' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code!: string;

  @ApiProperty({ example: 'Computer Science' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ enum: DepartmentStatusDto })
  @IsOptional()
  @IsEnum(DepartmentStatusDto)
  status?: DepartmentStatusDto;
}

export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) {}

export class DepartmentResponseDto {
  id!: string;
  tenantId!: string;
  institutionId!: string;
  code!: string;
  name!: string;
  description?: string | null;
  status!: string;
  /** Populated when Programs module links exist; empty until then */
  programs!: string[];
  institutionName?: string;
  createdAt!: string;
  updatedAt!: string;
}
