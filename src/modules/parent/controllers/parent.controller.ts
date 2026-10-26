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
import { ParentService } from '../services/parent.service';
import { RequirePermission } from '../../identity/decorators/require-permission.decorator';
import { CurrentUser } from '../../identity/decorators/current-user.decorator';
import type { AuthContext } from '../../identity/interfaces/auth-context.interface';
import {
  CreateParentStudentRelationshipDto,
  UpdateParentStudentRelationshipDto,
} from '../dto/relationship.dto';

@ApiTags('Parent Portal')
@ApiBearerAuth()
@Controller('parent')
export class ParentController {
  constructor(private readonly parent: ParentService) {}


  @Get('relationships')
  @RequirePermission('parent.relationship.manage')
  @ApiOperation({ summary: 'Admin: list parent-student relationships in tenant' })
  listRelationships(@CurrentUser() user: AuthContext) {
    return this.parent.listRelationships(user);
  }

  @Post('relationships')
  @RequirePermission('parent.relationship.manage')
  @ApiOperation({ summary: 'Admin: create parent-student relationship' })
  createRelationship(
    @CurrentUser() user: AuthContext,
    @Body() dto: CreateParentStudentRelationshipDto,
  ) {
    return this.parent.createRelationship(user, dto);
  }

  @Patch('relationships/:id')
  @RequirePermission('parent.relationship.manage')
  @ApiOperation({ summary: 'Admin: activate/revoke relationship' })
  updateRelationship(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateParentStudentRelationshipDto,
  ) {
    return this.parent.updateRelationshipStatus(user, id, dto.status);
  }

  @Get('students')
  @RequirePermission('parent.portal.read')
  @ApiOperation({ summary: 'List students linked to the authenticated parent' })
  listStudents(@CurrentUser() user: AuthContext) {
    return this.parent.listStudents(user);
  }

  @Get('students/:studentId')
  @RequirePermission('parent.portal.read')
  getStudent(
    @CurrentUser() user: AuthContext,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.parent.getStudent(user, studentId);
  }

  @Get('admissions')
  @RequirePermission('parent.portal.read')
  listAdmissions(
    @CurrentUser() user: AuthContext,
    @Query('studentId') studentId?: string,
  ) {
    return this.parent.listAdmissions(user, studentId);
  }

  @Get('admissions/:id')
  @RequirePermission('parent.portal.read')
  getAdmission(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.parent.getAdmission(user, id);
  }
}
