import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from '@supabase/supabase-js';

/**
 * Singleton wrapper around the Supabase admin (service-role) client.
 *
 * The client is created lazily so the API can still boot in environments
 * where SUPABASE_SERVICE_ROLE_KEY is intentionally absent (tests, read-only
 * deployments). Callers that *require* admin operations get a loud 500
 * with a clear message instead of a silent crash on first use.
 */
@Injectable()
export class SupabaseAdminService {
  private readonly logger = new Logger(SupabaseAdminService.name);
  private adminClient: SupabaseClient | null = null;
  private anonClient: SupabaseClient | null = null;

  constructor(private readonly config: ConfigService) {}

  getClient(): SupabaseClient {
    if (this.adminClient) return this.adminClient;

    const url = this.config.get<string>('supabase.url');
    const key = this.config.get<string | null>('supabase.serviceRoleKey');

    if (!url || !key) {
      this.logger.error(
        'SUPABASE_SERVICE_ROLE_KEY missing — admin operations are disabled',
      );
      throw new InternalServerErrorException(
        'Supabase admin istemcisi yapılandırılmamış (SUPABASE_SERVICE_ROLE_KEY eksik)',
      );
    }

    const options: SupabaseClientOptions<'public'> = {
      auth: { persistSession: false, autoRefreshToken: false },
    };
    this.adminClient = createClient(url, key, options);
    return this.adminClient;
  }

  /** Anon-key client — kullanıcı tarafı işlemler için (örn. signInWithOtp) */
  getAnonClient(): SupabaseClient {
    if (this.anonClient) return this.anonClient;

    const url = this.config.get<string>('supabase.url')!;
    const anonKey = this.config.get<string>('supabase.anonKey')!;
    this.anonClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return this.anonClient;
  }

  getAuthClient() {
    return this.getClient().auth.admin;
  }
}
