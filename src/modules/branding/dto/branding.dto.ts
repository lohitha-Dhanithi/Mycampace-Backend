import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class ApplyTemplateDto {
  @ApiProperty()
  @IsUUID()
  institutionId!: string;

  @ApiProperty({ example: 'EDUCORE_CLASSIC' })
  @IsString()
  @IsNotEmpty()
  templateCode!: string;
}

export class UpdateBrandingDto {
  @ApiProperty()
  @IsUUID()
  institutionId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  shortName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  welcomeMessage?: string;

  @ApiPropertyOptional({ description: 'Partial token overrides merged into draft' })
  @IsOptional()
  @IsObject()
  tokens?: Record<string, string>;
}

export class PublishBrandingDto {
  @ApiProperty()
  @IsUUID()
  institutionId!: string;
}
