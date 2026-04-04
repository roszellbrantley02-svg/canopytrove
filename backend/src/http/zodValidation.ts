import { RequestHandler } from 'express';
import { RequestValidationError } from './errors';

type FieldValidator = {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
};

type ValidationSchema = Record<string, FieldValidator>;

export function validateBody(schema: ValidationSchema): RequestHandler {
  return (request, _response, next) => {
    const body = request.body;
    const errors: Record<string, string> = {};

    for (const [field, rules] of Object.entries(schema)) {
      const value = body?.[field];

      if (rules.required && (value === undefined || value === null || value === '')) {
        errors[field] = `${field} is required`;
        continue;
      }

      if (value === undefined || value === null) {
        continue;
      }

      if (typeof value !== rules.type && rules.type !== 'array') {
        errors[field] = `${field} must be a ${rules.type}`;
        continue;
      }

      if (rules.type === 'array' && !Array.isArray(value)) {
        errors[field] = `${field} must be an array`;
        continue;
      }

      if (rules.type === 'string') {
        if (rules.minLength !== undefined && (value as string).length < rules.minLength) {
          errors[field] = `${field} must be at least ${rules.minLength} characters`;
        }
        if (rules.maxLength !== undefined && (value as string).length > rules.maxLength) {
          errors[field] = `${field} must be at most ${rules.maxLength} characters`;
        }
        if (rules.pattern && !rules.pattern.test(value as string)) {
          errors[field] = `${field} has invalid format`;
        }
      }

      if (rules.type === 'number') {
        if (rules.min !== undefined && (value as number) < rules.min) {
          errors[field] = `${field} must be at least ${rules.min}`;
        }
        if (rules.max !== undefined && (value as number) > rules.max) {
          errors[field] = `${field} must be at most ${rules.max}`;
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new RequestValidationError('Validation failed', errors);
    }

    next();
  };
}
