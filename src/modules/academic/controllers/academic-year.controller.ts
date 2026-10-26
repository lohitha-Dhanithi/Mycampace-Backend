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
import { AcademicYearService } from '../services/academic-year.service';
import {
  CreateAcademicYearDto,
  UpdateAcademicYearDto,
} from '../dto/academic-year.dto';
import { RequirePermission } from '../../identity/decorators/require-permission.decorator';
import { CurrentUser } from '../../identity/decorators/current-user.decorator';
import type { AuthContext } from '../../identity/interfaces/auth-context.interface';

@ApiTags('Academic Years')
@ApiBearerAuth()
@Controller('academic/years')
export class AcademicYearController {
  constructor(private readonly years: AcademicYearService) {}

  @Get()
  @RequirePermission('academic.year.read')
  @ApiOperation({ summary: 'List academic years (optional institution filter)' })
  list(
    @CurrentUser() user: AuthContext,
    @Query('institutionId') institutionId?: string,
  ) {
    return this.years.list(user, institutionId);
  }

  @Get(':id')
  @RequirePermission('academic.year.read')
  get(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.years.get(user, id);
  }

  @Post()
  @RequirePermission('academic.year.manage')
  create(
    @CurrentUser() user: AuthContext,
    @Body() dto: CreateAcademicYearDto,
  ) {
    return this.years.create(user, dto);
  }

  @Patch(':id')
  @RequirePermission('academic.year.manage')
  update(
    @CurrentUser() user: AuthContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAcademicYearDto,
  ) {
    return this.years.update(user, id, dto);
  }
}
