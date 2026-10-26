import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthTokensDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty({ example: '15m' })
  expiresIn!: string;

  @ApiProperty({ example: false })
  mfaRequired!: boolean;
}

export class MfaChallengeDto {
  @ApiProperty({ example: true })
  mfaRequired!: true;

  @ApiProperty({ description: 'Short-lived challenge token for MFA verify step' })
  mfaChallengeToken!: string;
}

export class MeResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  personaType!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  mfaEnabled!: boolean;

  @ApiPropertyOptional()
  activatedAt?: string | null;

  @ApiPropertyOptional()
  lastLoginAt?: string | null;
}
