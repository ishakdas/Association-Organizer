import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let detail = 'An unexpected error occurred';
    let title = 'Internal Server Error';
    let errors: Record<string, string[]> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'object' && response !== null) {
        const resp = response as Record<string, unknown>;
        detail = (resp.detail as string) ?? (resp.message as string) ?? detail;
        title = (resp.title as string) ?? (resp.error as string) ?? title;
        errors = resp.errors as Record<string, string[]> | undefined;
      } else if (typeof response === 'string') {
        detail = response;
      }
    }

    reply.status(status).send({
      type: 'about:blank',
      title,
      status,
      detail,
      instance: request.url,
      ...(errors && { errors }),
    });
  }
}
