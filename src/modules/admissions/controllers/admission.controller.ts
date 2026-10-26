import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdmissionService } from '../services/admission.service';
import {
  CreateAdmissionDto,
  UpdateAdmissionDto,
  UpdateAdmissionStatusDto,
} from '../dto/admission.dto';
import { RequirePermission } from '../../identity/decorators/require-permission.decorator';
import { CurrentUser } from '../../identity/decorators/current-user.decorator';
import type { AuthContext } from '../../identity/interfaces/auth-context.interface';

@ApiTags('Admissions')
@ApiBearerAuth()
@Controller('admissions')
export class AdmissionController {
  constructor(private readonly admissions: AdmissionService) {}

  @Get()
  @RequirePermission('admission.read')
  @ApiOperation({ summary: 'List admission applications for tenant' })
  list(
    @CurrentUser() user: AuthContext,
    @Query('institutionId') institutionId?: string,
    @Query('status') status?: string,
  ) {
    return this.admissions.list(user, { institutionId, status });
  }

  @Get('metrics')
  @RequirePermission('admission.read')
  @ApiOperation({ summary: 'Real application counts by status' })
  metrics(
    @CurrentUser() user: AuthContext,
    @Query('institutionId') institutionId?: string,
  ) {
    return this.admissions.metrics(user, institutionId);
  }


  // Applicant portal — ownership scoped (not CRM)
  @Get('me')
  @RequirePermission('admission.self')
  @ApiOperation({ summary: 'List applications owned by the authenticated applicant' })
  listMine(@CurrentUser() user: AuthContext) {
    return this.admissions.listMine(user);
  }

  @Get('me/:id')
  @RequirePermission('admission.self')
  getMine(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.admissions.getMine(user, id);
  }

  @Post('me')
  @RequirePermission('admission.self')
  createMine(
    @CurrentUser() user: AuthContext,
    @Body() dto: CreateAdmissionDto,
  ) {
    return this.admissions.createMine(user, dto);
  }

  @Patch('me/:id')
  @RequirePermission('admission.self')
  updateMine(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdmissionDto,
  ) {
    return this.admissions.updateMine(user, id, dto);
  }

  @Get(':id')
  @RequirePermission('admission.read')
  get(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.admissions.get(user, id);
  }

  @Post()
  @RequirePermission('admission.manage')
  create(
    @CurrentUser() user: AuthContext,
    @Body() dto: CreateAdmissionDto,
  ) {
    return this.admissions.create(user, dto);
  }

  @Patch(':id')
  @RequirePermission('admission.manage')
  update(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdmissionDto,
  ) {
    return this.admissions.update(user, id, dto);
  }

  @Patch(':id/status')
  @RequirePermission('admission.manage')
  updateStatus(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdmissionStatusDto,
  ) {
    return this.admissions.updateStatus(user, id, dto);
  }
}
