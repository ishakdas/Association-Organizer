import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { OrganisationsService } from './organisations.service';
import {
  createOrganisationSchema,
  CreateOrganisationInput,
  updateOrganisationSchema,
  UpdateOrganisationInput,
  addMemberSchema,
  AddMemberInput,
  updateMemberRoleSchema,
  UpdateMemberRoleInput,
} from '@ticketbot/shared-validation';

@Controller('organisations')
export class OrganisationsController {
  constructor(private readonly organisationsService: OrganisationsService) {}

  @Post()
  @UseGuards(AuthGuard)
  create(
    @Body(new ZodValidationPipe(createOrganisationSchema)) body: CreateOrganisationInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.organisationsService.create(body, user.id);
  }

  @Get()
  @UseGuards(AuthGuard)
  listMine(@CurrentUser() user: RequestUser) {
    return this.organisationsService.listMine(user.id);
  }

  @Get(':organisationId')
  @UseGuards(AuthGuard, TenantGuard)
  findOne(@Param('organisationId') organisationId: string) {
    return this.organisationsService.findOne(organisationId);
  }

  @Patch(':organisationId')
  @UseGuards(AuthGuard, TenantGuard, RolesGuard)
  @Roles('ADMIN')
  update(
    @Param('organisationId') organisationId: string,
    @Body(new ZodValidationPipe(updateOrganisationSchema)) body: UpdateOrganisationInput,
  ) {
    return this.organisationsService.update(organisationId, body);
  }

  @Get(':organisationId/members')
  @UseGuards(AuthGuard, TenantGuard)
  listMembers(@Param('organisationId') organisationId: string) {
    return this.organisationsService.listMembers(organisationId);
  }

  @Post(':organisationId/members')
  @UseGuards(AuthGuard, TenantGuard, RolesGuard)
  @Roles('ADMIN')
  addMember(
    @Param('organisationId') organisationId: string,
    @Body(new ZodValidationPipe(addMemberSchema)) body: AddMemberInput,
  ) {
    return this.organisationsService.addMember(organisationId, body);
  }

  @Patch(':organisationId/members/:userId')
  @UseGuards(AuthGuard, TenantGuard, RolesGuard)
  @Roles('ADMIN')
  updateMemberRole(
    @Param('organisationId') organisationId: string,
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(updateMemberRoleSchema)) body: UpdateMemberRoleInput,
  ) {
    return this.organisationsService.updateMemberRole(organisationId, userId, body);
  }

  @Delete(':organisationId/members/:userId')
  @UseGuards(AuthGuard, TenantGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(204)
  async removeMember(
    @Param('organisationId') organisationId: string,
    @Param('userId') userId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.organisationsService.removeMember(organisationId, userId, actor.id);
  }
}
