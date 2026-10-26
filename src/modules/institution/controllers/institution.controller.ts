import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InstitutionService } from '../services/institution.service';
import {
  CreateInstitutionDto,
  UpdateInstitutionDto,
} from '../dto/institution.dto';
import { RequirePermission } from '../../identity/decorators/require-permission.decorator';
import { CurrentUser } from '../../identity/decorators/current-user.decorator';
import type { AuthContext } from '../../identity/interfaces/auth-context.interface';

@ApiTags('Institutions')
@ApiBearerAuth()
@Controller('institutions')
export class InstitutionController {
  constructor(private readonly institutions: InstitutionService) {}

  @Get()
  @RequirePermission('institution.read')
  @ApiOperation({ summary: 'List institutions for the authenticated tenant' })
  list(@CurrentUser() user: AuthContext) {
    return this.institutions.list(user);
  }

  @Get(':id')
  @RequirePermission('institution.read')
  @ApiOperation({ summary: 'Get institution by id (tenant-scoped)' })
  get(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.institutions.getById(user, id);
  }

  @Post()
  @RequirePermission('institution.manage')
  @ApiOperation({ summary: 'Create institution in authenticated tenant' })
  create(
    @CurrentUser() user: AuthContext,
    @Body() dto: CreateInstitutionDto,
  ) {
    return this.institutions.create(user, dto);
  }

  @Patch(':id')
  @RequirePermission('institution.manage')
  @ApiOperation({ summary: 'Update institution (tenant-scoped)' })
  update(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInstitutionDto,
  ) {
    return this.institutions.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermission('institution.manage')
  @ApiOperation({ summary: 'Archive institution (soft delete)' })
  archive(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.institutions.archive(user, id);
  }
}
