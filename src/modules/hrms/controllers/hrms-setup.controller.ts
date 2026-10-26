import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HrmsSetupService } from '../services/hrms-setup.service';
import {
  CreateCategoryDto,
  CreateHrmsDepartmentDto,
  CreateLeaveTypeDto,
  ReplaceMetricTemplatesDto,
  UpdateCategoryDto,
  UpdateHrmsDepartmentDto,
  UpdateLeaveTypeDto,
} from '../dto/hrms-setup.dto';
import { RequirePermission } from '../../identity/decorators/require-permission.decorator';
import { CurrentUser } from '../../identity/decorators/current-user.decorator';
import type { AuthContext } from '../../identity/interfaces/auth-context.interface';

@ApiTags('HRMS Setup')
@ApiBearerAuth()
@Controller('hrms/setup')
export class HrmsSetupController {
  constructor(private readonly setup: HrmsSetupService) {}

  // Read access is shared with My Portal users so staff forms can load lookups
  @Get('categories')
  @RequirePermission('hrms.setup.read', 'hrms.self')
  @ApiOperation({ summary: 'List staff categories (seeds Teaching / Non-Teaching on first use)' })
  categories(@CurrentUser() user: AuthContext) {
    return this.setup.listCategories(user);
  }

  @Post('categories')
  @RequirePermission('hrms.setup.manage')
  createCategory(@CurrentUser() user: AuthContext, @Body() dto: CreateCategoryDto) {
    return this.setup.createCategory(user, dto);
  }

  @Patch('categories/:id')
  @RequirePermission('hrms.setup.manage')
  updateCategory(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.setup.updateCategory(user, id, dto);
  }

  @Get('categories/:id/metrics')
  @RequirePermission('hrms.setup.read')
  @ApiOperation({ summary: 'Appraisal metric template for a category' })
  metrics(@CurrentUser() user: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.setup.getMetricTemplates(user, id);
  }

  @Put('categories/:id/metrics')
  @RequirePermission('hrms.setup.manage')
  @ApiOperation({ summary: 'Replace the appraisal metric template (weights must total 100)' })
  replaceMetrics(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceMetricTemplatesDto,
  ) {
    return this.setup.replaceMetricTemplates(user, id, dto);
  }

  @Get('departments')
  @RequirePermission('hrms.setup.read', 'hrms.self')
  departments(@CurrentUser() user: AuthContext) {
    return this.setup.listDepartments(user);
  }

  @Post('departments')
  @RequirePermission('hrms.setup.manage')
  createDepartment(@CurrentUser() user: AuthContext, @Body() dto: CreateHrmsDepartmentDto) {
    return this.setup.createDepartment(user, dto);
  }

  @Patch('departments/:id')
  @RequirePermission('hrms.setup.manage')
  updateDepartment(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHrmsDepartmentDto,
  ) {
    return this.setup.updateDepartment(user, id, dto);
  }

  @Get('leave-types')
  @RequirePermission('hrms.setup.read', 'hrms.self')
  leaveTypes(@CurrentUser() user: AuthContext) {
    return this.setup.listLeaveTypes(user);
  }

  @Post('leave-types')
  @RequirePermission('hrms.setup.manage')
  createLeaveType(@CurrentUser() user: AuthContext, @Body() dto: CreateLeaveTypeDto) {
    return this.setup.createLeaveType(user, dto);
  }

  @Patch('leave-types/:id')
  @RequirePermission('hrms.setup.manage')
  updateLeaveType(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeaveTypeDto,
  ) {
    return this.setup.updateLeaveType(user, id, dto);
  }
}
