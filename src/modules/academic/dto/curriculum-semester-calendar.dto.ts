import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum CurriculumStatusDto { DRAFT = 'DRAFT', ACTIVE = 'ACTIVE', ARCHIVED = 'ARCHIVED' }
export enum SemesterStatusDto { ACTIVE = 'ACTIVE', INACTIVE = 'INACTIVE', ARCHIVED = 'ARCHIVED' }
export enum CalendarEventTypeDto { HOLIDAY = 'HOLIDAY', BREAK = 'BREAK', EXAM = 'EXAM', EVENT = 'EVENT', OTHER = 'OTHER' }
export enum CalendarEventStatusDto { SCHEDULED = 'SCHEDULED', CANCELLED = 'CANCELLED', ARCHIVED = 'ARCHIVED' }

export class CurriculumCourseItemDto {
  @ApiProperty() @IsUUID() courseId!: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) sequence?: number;
}

export class CreateCurriculumDto {
  @ApiProperty() @IsUUID() programId!: string;
  @ApiProperty() @IsUUID() academicYearId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(40) code!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;
  @ApiPropertyOptional({ enum: CurriculumStatusDto }) @IsOptional() @IsEnum(CurriculumStatusDto) status?: CurriculumStatusDto;
  @ApiPropertyOptional({ type: [CurriculumCourseItemDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CurriculumCourseItemDto)
  courses?: CurriculumCourseItemDto[];
}
export class UpdateCurriculumDto extends PartialType(CreateCurriculumDto) {}

export class CreateSemesterDto {
  @ApiProperty() @IsUUID() academicYearId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(30) code!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(100) name!: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) sequence?: number;
  @ApiProperty() @IsDateString() startDate!: string;
  @ApiProperty() @IsDateString() endDate!: string;
  @ApiPropertyOptional({ enum: SemesterStatusDto }) @IsOptional() @IsEnum(SemesterStatusDto) status?: SemesterStatusDto;
}
export class UpdateSemesterDto extends PartialType(CreateSemesterDto) {}

export class CreateCalendarEventDto {
  @ApiProperty() @IsUUID() academicYearId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() semesterId?: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200) title!: string;
  @ApiPropertyOptional({ enum: CalendarEventTypeDto }) @IsOptional() @IsEnum(CalendarEventTypeDto) eventType?: CalendarEventTypeDto;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;
  @ApiProperty() @IsDateString() startDate!: string;
  @ApiProperty() @IsDateString() endDate!: string;
  @ApiPropertyOptional({ enum: CalendarEventStatusDto }) @IsOptional() @IsEnum(CalendarEventStatusDto) status?: CalendarEventStatusDto;
}
export class UpdateCalendarEventDto extends PartialType(CreateCalendarEventDto) {}
