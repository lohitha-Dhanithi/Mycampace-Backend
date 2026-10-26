import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'admin@school.edu' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiPropertyOptional({
    description: 'Optional tenant code when the same email exists across tenants',
    example: 'demo-school',
  })
  @IsOptional()
  @IsString()
  tenantCode?: string;
}

export class ForgotPasswordResponseDto {
  @ApiProperty({
    example: 'If an account exists for this email, a password reset link has been sent.',
  })
  message!: string;
}
