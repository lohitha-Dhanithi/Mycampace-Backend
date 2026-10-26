import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@school.edu' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'SecurePass1!' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  password!: string;

  @ApiPropertyOptional({
    description: 'Tenant code for multi-tenant entry. Required when email is not unique across tenants.',
    example: 'demo-school',
  })
  @IsOptional()
  @IsString()
  tenantCode?: string;
}
