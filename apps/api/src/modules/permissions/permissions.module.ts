import { Module } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { PermissionsController } from './permissions.controller';

@Module({
  controllers: [PermissionsController],
  providers: [PermissionService],
  exports: [PermissionService],
})
export class PermissionsModule {}
