import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Opaque password-reset token from the reset link' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ example: 'NewSecurePass1!' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  newPassword!: string;

  @ApiProperty({ example: 'NewSecurePass1!' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  confirmPassword!: string;
}

export class ResetPasswordResponseDto {
  @ApiProperty({ example: 'Your password has been updated successfully.' })
  message!: string;
}
