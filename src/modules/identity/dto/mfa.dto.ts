import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class MfaEnrollVerifyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  factorId!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code!: string;
}

export class MfaVerifyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  challengeToken!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code!: string;
}

export class MfaDisableDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  factorId!: string;
}
