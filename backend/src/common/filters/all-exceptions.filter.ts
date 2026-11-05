import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Error as MongooseError } from 'mongoose';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  requestId?: string;
}

function isDuplicateKeyError(
  err: unknown,
): err is { code: number; keyValue?: Record<string, unknown> } {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000;
}

/** Single error shape for every failure; never leaks internals for 5xx. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const body = this.toBody(exception);
    body.requestId = req.id !== undefined ? String(req.id) : undefined;

    if (body.statusCode >= 500) {
      this.logger.error(
        { err: exception, path: req.originalUrl, method: req.method, requestId: body.requestId },
        exception instanceof Error ? exception.message : 'Unhandled exception',
      );
    }

    if (!res.headersSent) res.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ErrorBody {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return { statusCode: status, error: exception.name, message: response };
      }
      const r = response as { message?: string | string[]; error?: string };
      return {
        statusCode: status,
        error: r.error ?? exception.name,
        message: r.message ?? exception.message,
      };
    }

    if (isDuplicateKeyError(exception)) {
      const field = Object.keys(exception.keyValue ?? {})[0] ?? 'value';
      return {
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message: `${field} already exists`,
      };
    }

    if (exception instanceof MongooseError.CastError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: `Invalid value for ${exception.path}`,
      };
    }

    if (exception instanceof MongooseError.ValidationError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: Object.values(exception.errors).map((e) => e.message),
      };
    }

    // body-parser errors (malformed JSON, payload too large) carry a status.
    const status = (exception as { status?: unknown })?.status;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return {
        statusCode: status,
        error: 'Bad Request',
        message: (exception as Error).message,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Something went wrong',
    };
  }
}
