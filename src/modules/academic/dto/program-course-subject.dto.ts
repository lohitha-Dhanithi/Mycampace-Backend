import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum CatalogStatusDto {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export class CreateProgramDto {
  @ApiProperty() @IsUUID() institutionId!: string;
  @ApiProperty() @IsUUID() departmentId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(30) code!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;
  @ApiPropertyOptional({ enum: CatalogStatusDto }) @IsOptional() @IsEnum(CatalogStatusDto) status?: CatalogStatusDto;
}
export class UpdateProgramDto extends PartialType(CreateProgramDto) {}

export class CreateCourseDto {
  @ApiProperty() @IsUUID() programId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(30) code!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) credits?: number;
  @ApiPropertyOptional({ enum: CatalogStatusDto }) @IsOptional() @IsEnum(CatalogStatusDto) status?: CatalogStatusDto;
}
export class UpdateCourseDto extends PartialType(CreateCourseDto) {}

export class CreateSubjectDto {
  @ApiProperty() @IsUUID() courseId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(30) code!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) sequence?: number;
  @ApiPropertyOptional({ enum: CatalogStatusDto }) @IsOptional() @IsEnum(CatalogStatusDto) status?: CatalogStatusDto;
}
export class UpdateSubjectDto extends PartialType(CreateSubjectDto) {}
