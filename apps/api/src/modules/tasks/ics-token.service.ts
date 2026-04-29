import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

// Signs and verifies short-lived, capability-style tokens for the
// public ICS download endpoint. Format: `<expSeconds>.<hexHmac>` where
// hexHmac = HMAC-SHA256("<taskId>:<expSeconds>", JWT_SECRET).
@Injectable()
export class IcsTokenService {
  constructor(private readonly config: ConfigService) {}

  signTaskIcsUrl(taskId: string): string {
    const expSeconds = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
    const sig = this.hmac(`${taskId}:${expSeconds}`);
    const apiUrl = this.config.get<string>('apiUrl')!;
    return `${apiUrl}/api/v1/tasks/${taskId}/ics?t=${expSeconds}.${sig}`;
  }

  verifyTaskIcsToken(taskId: string, token: string | undefined): boolean {
    if (!token) return false;
    const dot = token.indexOf('.');
    if (dot <= 0) return false;
    const expPart = token.slice(0, dot);
    const sigPart = token.slice(dot + 1);
    const expSeconds = Number(expPart);
    if (!Number.isInteger(expSeconds) || expSeconds <= 0) return false;
    if (expSeconds < Math.floor(Date.now() / 1000)) return false;

    const expected = this.hmac(`${taskId}:${expSeconds}`);
    if (sigPart.length !== expected.length) return false;
    try {
      return timingSafeEqual(Buffer.from(sigPart), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  // ICS UID host — derived from API_URL so a single tenant has a stable
  // UID across restarts, but multiple deployments don't collide.
  uidDomain(): string {
    const apiUrl = this.config.get<string>('apiUrl')!;
    try {
      return new URL(apiUrl).hostname;
    } catch {
      return 'aktivist.local';
    }
  }

  private hmac(payload: string): string {
    const secret = this.config.get<string>('jwt.secret')!;
    return createHmac('sha256', secret).update(payload).digest('hex');
  }
}
