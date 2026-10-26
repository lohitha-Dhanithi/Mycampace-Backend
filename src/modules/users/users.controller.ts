// backend/src/modules/users/users.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger'
import { UsersService, CreateUserDto, CreateRoleDto, UpdateRoleDto } from './users.service'
import { CurrentUser, AuthenticatedUser } from '@/common/auth/current-user.decorator'
import { RequirePlatformRole } from '@/common/auth/rbac.decorators'
import { RbacGuard } from '@/common/auth/rbac.guard'

@ApiTags('Users & Platform RBAC')
@ApiBearerAuth()
@UseGuards(RbacGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get scoped platform users with product roles' })
  @ApiResponse({ status: 200, description: 'List of scoped users' })
  async getUsers(
    @Query('product') product?: string,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('campusId') campusId?: string,
    @Query('organizationId') organizationId?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.usersService.getUsers(
      { product, search, role, campusId, organizationId },
      user,
    )
  }

  @Post()
  @RequirePlatformRole('SuperAdmin', 'OrganizationAdmin', 'CampusAdmin')
  @ApiOperation({ summary: 'Create a new user with platform role and product assignments' })
  @ApiResponse({ status: 201, description: 'User successfully created' })
  async createUser(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.createUser(dto, user)
  }

  @Patch(':id/product-roles')
  @RequirePlatformRole('SuperAdmin', 'OrganizationAdmin', 'CampusAdmin')
  @ApiOperation({ summary: 'Update product roles and platform authority for user' })
  @ApiResponse({ status: 200, description: 'User roles updated' })
  async updateProductRoles(
    @Param('id') id: string,
    @Body() body: { productRoles: Record<string, string>; platformRole?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.updateUserProductRoles(
      id,
      body.productRoles,
      body.platformRole,
      user,
    )
  }

  @Get('roles')
  @ApiOperation({ summary: 'Get system role templates and organization custom roles' })
  @ApiResponse({ status: 200, description: 'List of product roles' })
  async getRoles(
    @Query('productId') productId?: string,
    @Query('organizationId') organizationId?: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.usersService.getRoles({ productId, organizationId }, user)
  }

  @Post('roles')
  @RequirePlatformRole('SuperAdmin', 'OrganizationAdmin')
  @ApiOperation({ summary: 'Create a custom product role with permission matrix' })
  @ApiResponse({ status: 201, description: 'Custom role created' })
  async createRole(
    @Body() dto: CreateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.createCustomRole(dto, user)
  }

  @Patch('roles/:id')
  @RequirePlatformRole('SuperAdmin', 'OrganizationAdmin')
  @ApiOperation({ summary: 'Update custom role permissions or details' })
  @ApiResponse({ status: 200, description: 'Role updated' })
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.updateCustomRole(id, dto, user)
  }

  @Delete('roles/:id')
  @RequirePlatformRole('SuperAdmin', 'OrganizationAdmin')
  @ApiOperation({ summary: 'Delete custom product role' })
  @ApiResponse({ status: 200, description: 'Role deleted' })
  async deleteRole(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.deleteCustomRole(id, user)
  }
}
