import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEmail, IsIn, IsNotEmpty, MaxLength, MinLength, IsOptional, IsString } from 'class-validator'

export class EmailSignInDto {
  @ApiProperty({ example: 'owner@school.edu.in', description: 'Institutional email' })
  @IsEmail()
  email: string

  @ApiProperty({ example: 'SecurePassword123!', description: 'User password' })
  @IsNotEmpty()
  password: string
}

export class SignUpDto {
  @ApiProperty({ example: 'Dr. Anand Verma' })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({ example: 'owner@institution.edu' })
  @IsEmail()
  email: string

  @ApiProperty({ example: 'SecurePassword123' })
  @MinLength(6)
  password: string
}

export class GoogleAuthDto {
  @ApiPropertyOptional({ example: 'oauth2-google-token-code-xyz' })
  @IsOptional()
  @IsString()
  token?: string

  @ApiPropertyOptional({ example: 'google-id-token-jwt' })
  @IsOptional()
  @IsString()
  idToken?: string

  @ApiPropertyOptional({ example: 'owner@school.edu.in' })
  @IsOptional()
  @IsEmail()
  email?: string
}

/** Refresh normally comes from the HttpOnly cookie; the body field is a non-browser fallback. */
export class RefreshTokenDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  refreshToken?: string
}

export class LogoutDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  refreshToken?: string
}

/** Browser tab presence, sent as query parameters (see AuthController.tabLifecycle). */
export class TabLifecycleDto {
  @ApiProperty({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  tabId: string

  @ApiProperty({ enum: ['ping', 'hide'] })
  @IsIn(['ping', 'hide'])
  phase: 'ping' | 'hide'
}
