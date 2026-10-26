import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DepartmentService } from '../services/department.service';
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
} from '../dto/department.dto';
import { RequirePermission } from '../../identity/decorators/require-permission.decorator';
import { CurrentUser } from '../../identity/decorators/current-user.decorator';
import type { AuthContext } from '../../identity/interfaces/auth-context.interface';

@ApiTags('Academic Departments')
@ApiBearerAuth()
@Controller('academic/departments')
export class DepartmentController {
  constructor(private readonly departments: DepartmentService) {}

  @Get()
  @RequirePermission('academic.department.read')
  @ApiOperation({ summary: 'List departments (optional institution filter)' })
  list(
    @CurrentUser() user: AuthContext,
    @Query('institutionId') institutionId?: string,
  ) {
    return this.departments.list(user, institutionId);
  }

  @Get(':id')
  @RequirePermission('academic.department.read')
  get(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.departments.get(user, id);
  }

  @Post()
  @RequirePermission('academic.department.manage')
  create(
    @CurrentUser() user: AuthContext,
    @Body() dto: CreateDepartmentDto,
  ) {
    return this.departments.create(user, dto);
  }

  @Patch(':id')
  @RequirePermission('academic.department.manage')
  update(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departments.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermission('academic.department.manage')
  archive(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.departments.archive(user, id);
  }
}
