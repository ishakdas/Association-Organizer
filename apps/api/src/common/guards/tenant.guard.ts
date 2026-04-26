import { CanActivate, Injectable } from '@nestjs/common';

/**
 * Placeholder guard. Original Organisation-tenancy guard was removed when the
 * workspace concept was deleted. Replaced functionally by SupabaseUserGuard
 * plus association-scoped lookups in service layers.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}
