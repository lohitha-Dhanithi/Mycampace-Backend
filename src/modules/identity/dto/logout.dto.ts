import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LogoutDto {
  @ApiPropertyOptional({
    description: 'Opaque refresh token to revoke. If omitted, all active sessions for the user may be handled by client discarding tokens.',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
