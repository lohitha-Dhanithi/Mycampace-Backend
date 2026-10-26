import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateParentStudentRelationshipDto {
  @ApiProperty()
  @IsUUID()
  parentUserId!: string;

  @ApiProperty()
  @IsUUID()
  studentUserId!: string;

  @ApiProperty({ example: 'GUARDIAN' })
  @IsString()
  @MaxLength(30)
  relationshipType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @ApiPropertyOptional({ enum: ['PENDING', 'ACTIVE'] })
  @IsOptional()
  @IsIn(['PENDING', 'ACTIVE'])
  status?: 'PENDING' | 'ACTIVE';
}

export class UpdateParentStudentRelationshipDto {
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE', 'REVOKED', 'PENDING'] })
  @IsIn(['ACTIVE', 'INACTIVE', 'REVOKED', 'PENDING'])
  status!: 'ACTIVE' | 'INACTIVE' | 'REVOKED' | 'PENDING';
}
