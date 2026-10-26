import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StaffStatus } from '../../../generated/prisma-client';
import { StaffService } from '../services/staff.service';
import { LeaveService } from '../services/leave.service';
import {
  AddCertificationDto,
  AddServiceEventDto,
  AddStaffDocumentDto,
  CreateStaffDto,
  UpdateDocumentStatusDto,
  UpdateStaffDto,
} from '../dto/staff.dto';
import { RequirePermission } from '../../identity/decorators/require-permission.decorator';
import { CurrentUser } from '../../identity/decorators/current-user.decorator';
import type { AuthContext } from '../../identity/interfaces/auth-context.interface';

@ApiTags('HRMS Staff')
@ApiBearerAuth()
@Controller('hrms/staff')
export class StaffController {
  constructor(
    private readonly staff: StaffService,
    private readonly leave: LeaveService,
  ) {}

  @Get()
  @RequirePermission('hrms.staff.read')
  @ApiOperation({ summary: 'Staff directory (search, filters, pagination)' })
  list(
    @CurrentUser() user: AuthContext,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('campusId') campusId?: string,
    @Query('status', new ParseEnumPipe(StaffStatus, { optional: true })) status?: StaffStatus,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize?: number,
  ) {
    return this.staff.list(user, { search, categoryId, departmentId, campusId, status, page, pageSize });
  }

  @Post()
  @RequirePermission('hrms.staff.manage')
  @ApiOperation({ summary: 'Create staff (generates EMP-#### code, joining event, leave balances, appraisal)' })
  create(@CurrentUser() user: AuthContext, @Body() dto: CreateStaffDto) {
    return this.staff.create(user, dto);
  }

  @Patch('documents/:documentId/status')
  @RequirePermission('hrms.staff.manage')
  updateDocumentStatus(
    @CurrentUser() user: AuthContext,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: UpdateDocumentStatusDto,
  ) {
    return this.staff.updateDocumentStatus(user, documentId, dto);
  }

  @Get(':id')
  @RequirePermission('hrms.staff.read')
  get(@CurrentUser() user: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.staff.get(user, id);
  }

  @Get(':id/profile')
  @RequirePermission('hrms.staff.read')
  @ApiOperation({ summary: 'Documents, service history, certifications, leave balances and appraisal' })
  profile(@CurrentUser() user: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.staff.profile(user, id);
  }

  @Patch(':id')
  @RequirePermission('hrms.staff.manage')
  update(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.staff.update(user, id, dto);
  }

  @Get(':id/leave-balances')
  @RequirePermission('hrms.staff.read')
  balances(@CurrentUser() user: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.leave.balancesFor(user, id);
  }

  @Post(':id/documents')
  @RequirePermission('hrms.staff.manage')
  addDocument(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddStaffDocumentDto,
  ) {
    return this.staff.addDocument(user, id, dto);
  }

  @Post(':id/service-events')
  @RequirePermission('hrms.staff.manage')
  addServiceEvent(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddServiceEventDto,
  ) {
    return this.staff.addServiceEvent(user, id, dto);
  }

  @Post(':id/certifications')
  @RequirePermission('hrms.staff.manage')
  addCertification(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddCertificationDto,
  ) {
    return this.staff.addCertification(user, id, dto);
  }
}
