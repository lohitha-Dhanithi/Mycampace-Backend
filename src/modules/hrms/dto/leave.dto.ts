import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateLeaveDto {
  @ApiProperty()
  @IsUUID()
  leaveTypeId!: string;

  @ApiProperty({ example: '2026-10-20' })
  @Matches(ISO_DATE, { message: 'fromDate must be YYYY-MM-DD' })
  fromDate!: string;

  @ApiProperty({ example: '2026-10-21' })
  @Matches(ISO_DATE, { message: 'toDate must be YYYY-MM-DD' })
  toDate!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}

/** HR creating a leave request on behalf of a staff member. */
export class CreateLeaveForStaffDto extends CreateLeaveDto {
  @ApiProperty()
  @IsUUID()
  staffId!: string;
}

export enum LeaveActionDto {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class DecideLeaveDto {
  @ApiProperty({ enum: LeaveActionDto })
  @IsEnum(LeaveActionDto)
  action!: LeaveActionDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class CancelLeaveDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
