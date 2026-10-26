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
import { CampusService } from '../services/campus.service';
import { CreateCampusDto, UpdateCampusDto } from '../dto/campus.dto';
import { CreateCampusAssignmentDto } from '../dto/assignment.dto';
import { RequirePermission } from '../../identity/decorators/require-permission.decorator';
import { CurrentUser } from '../../identity/decorators/current-user.decorator';
import type { AuthContext } from '../../identity/interfaces/auth-context.interface';

@ApiTags('Campuses')
@ApiBearerAuth()
@Controller('campuses')
export class CampusController {
  constructor(private readonly campuses: CampusService) {}

  @Get()
  @RequirePermission('campus.read')
  @ApiOperation({ summary: 'List campuses for tenant (optional institution filter)' })
  list(
    @CurrentUser() user: AuthContext,
    @Query('institutionId') institutionId?: string,
  ) {
    return this.campuses.list(user, institutionId);
  }


  @Get('assignments/me')
  @RequirePermission('campus.read')
  @ApiOperation({ summary: 'List campuses assigned to current user' })
  myAssignments(@CurrentUser() user: AuthContext) {
    return this.campuses.listMyCampuses(user);
  }

  @Post('assignments')
  @RequirePermission('campus.assign')
  assign(
    @CurrentUser() user: AuthContext,
    @Body() dto: CreateCampusAssignmentDto,
  ) {
    return this.campuses.assignUser(user, dto);
  }

  @Delete('assignments/:assignmentId')
  @RequirePermission('campus.assign')
  revokeAssignment(
    @CurrentUser() user: AuthContext,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
  ) {
    return this.campuses.revokeAssignment(user, assignmentId);
  }

  @Get(':id')
  @RequirePermission('campus.read')
  get(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.campuses.get(user, id);
  }

  @Post()
  @RequirePermission('campus.manage')
  create(@CurrentUser() user: AuthContext, @Body() dto: CreateCampusDto) {
    return this.campuses.create(user, dto);
  }

  @Patch(':id')
  @RequirePermission('campus.manage')
  update(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCampusDto,
  ) {
    return this.campuses.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermission('campus.manage')
  archive(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.campuses.archive(user, id);
  }
}
