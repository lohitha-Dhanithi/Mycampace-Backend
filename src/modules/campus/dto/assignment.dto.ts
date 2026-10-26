import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class CreateCampusAssignmentDto {
  @ApiProperty()
  @IsUUID()
  userId!: string;

  @ApiProperty()
  @IsUUID()
  campusId!: string;
}

export class UpdateCampusAssignmentDto {
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE', 'REVOKED'] })
  @IsIn(['ACTIVE', 'INACTIVE', 'REVOKED'])
  status!: 'ACTIVE' | 'INACTIVE' | 'REVOKED';
}
