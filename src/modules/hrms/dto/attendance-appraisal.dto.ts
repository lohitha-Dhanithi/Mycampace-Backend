import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export enum AttendanceStatusDto {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
  ON_LEAVE = 'ON_LEAVE',
}

export class MarkAttendanceDto {
  @ApiProperty()
  @IsUUID()
  staffId!: string;

  @ApiProperty({ example: '2026-10-12' })
  @Matches(ISO_DATE, { message: 'date must be YYYY-MM-DD' })
  date!: string;

  @ApiProperty({ enum: AttendanceStatusDto })
  @IsEnum(AttendanceStatusDto)
  status!: AttendanceStatusDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  checkInAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  checkOutAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

export class UpdateAttendanceDto {
  @ApiProperty({ enum: AttendanceStatusDto })
  @IsEnum(AttendanceStatusDto)
  status!: AttendanceStatusDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  checkInAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  checkOutAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

export class GenerateAttendanceDto {
  @ApiProperty({ example: '2026-10-12' })
  @Matches(ISO_DATE, { message: 'date must be YYYY-MM-DD' })
  date!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  campusId?: string;
}

export class CreateAppraisalCycleDto {
  @ApiProperty({ example: 'Annual Appraisal 2026-27' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @ApiProperty()
  @Matches(ISO_DATE, { message: 'startDate must be YYYY-MM-DD' })
  startDate!: string;

  @ApiProperty()
  @Matches(ISO_DATE, { message: 'endDate must be YYYY-MM-DD' })
  endDate!: string;
}

export class ScoreMetricDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;
}

export class AdvanceAppraisalDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
