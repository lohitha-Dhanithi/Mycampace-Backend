import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ActivateAccountDto {
  @ApiProperty({ description: 'Opaque activation token from invitation/activation link' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ example: 'SecurePass1!' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  password!: string;

  @ApiProperty({ example: 'SecurePass1!' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  confirmPassword!: string;
}

export class ActivateAccountResponseDto {
  @ApiProperty({
    example: 'Your account has been activated. You can now sign in.',
  })
  message!: string;
}
