import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'student@school.edu' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  password!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  confirmPassword!: string;

  @ApiProperty({
    description: 'Role code from registration-options (requested role, not auto-granted for privileged roles)',
    example: 'STUDENT',
  })
  @IsString()
  @IsNotEmpty()
  registrationRoleCode!: string;

  @ApiProperty({
    description: 'Institution / tenant code — server resolves tenant; client must not send tenantId',
    example: 'demo-school',
  })
  @IsString()
  @IsNotEmpty()
  tenantCode!: string;
}

export class RegistrationOptionDto {
  @ApiProperty()
  code!: string;

  @ApiProperty()
  displayName!: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty()
  registrationMode!: string;

  @ApiProperty()
  invitationRequired!: boolean;

  @ApiProperty()
  selfRegistrationAllowed!: boolean;
}
