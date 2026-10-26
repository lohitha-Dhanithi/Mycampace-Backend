import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Teaching' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isTeaching?: boolean;
}
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

export class CreateHrmsDepartmentDto {
  @ApiProperty({ example: 'Human Resources' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  academicDepartmentId?: string;

  @ApiPropertyOptional({ description: 'Staff id of the department head (HOD reviewer)' })
  @IsOptional()
  @IsUUID()
  headStaffId?: string;
}
export class UpdateHrmsDepartmentDto extends PartialType(CreateHrmsDepartmentDto) {}

export class CreateLeaveTypeDto {
  @ApiProperty({ example: 'CASUAL' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code!: string;

  @ApiProperty({ example: 'Casual Leave' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 12, description: 'Annual entitlement. Omit for types without a balance.' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(366)
  defaultEntitlement?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  deductsBalance?: boolean;
}
export class UpdateLeaveTypeDto extends PartialType(CreateLeaveTypeDto) {}

export class MetricTemplateItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiProperty({ example: 30 })
  @IsInt()
  @Min(1)
  @Max(100)
  weight!: number;
}

export class ReplaceMetricTemplatesDto {
  @ApiProperty({ type: [MetricTemplateItemDto], description: 'Weights must total 100' })
  metrics!: MetricTemplateItemDto[];
}

export class CreateShiftDto {
  @ApiProperty()
  @IsUUID()
  campusId!: string;

  @ApiProperty({ example: 'General Shift' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: '09:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'startTime must be HH:mm' })
  startTime!: string;

  @ApiProperty({ example: '17:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'endTime must be HH:mm' })
  endTime!: string;

  @ApiPropertyOptional({ default: 15 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  graceMinutes?: number;
}
export class UpdateShiftDto extends PartialType(CreateShiftDto) {}

export class AssignShiftDto {
  @ApiProperty({ type: [String] })
  @IsUUID('4', { each: true })
  staffIds!: string[];

  @ApiProperty({ example: '2026-10-12' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'effectiveFrom must be YYYY-MM-DD' })
  effectiveFrom!: string;
}
