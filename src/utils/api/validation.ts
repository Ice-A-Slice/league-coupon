import { NextRequest } from 'next/server';
import { logger } from '@/utils/logger';

/**
 * Validation error interface
 */
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Admin authentication check for API endpoints
 */
export function isAdminAuthenticated(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    logger.error('API Validation: CRON_SECRET not configured');
    return false;
  }

  return (
    (authHeader !== null && authHeader === `Bearer ${expectedSecret}`) ||
    (cronSecret !== null && cronSecret === expectedSecret)
  );
}

/**
 * Log unauthorized access attempts
 */
export function logUnauthorizedAccess(request: NextRequest, requestId?: string): void {
  logger.warn('API Validation: Unauthorized access attempt', {
    requestId,
    userAgent: request.headers.get('user-agent'),
    path: request.nextUrl.pathname,
    method: request.method,
    timestamp: new Date().toISOString()
  });
}

/**
 * Validate required fields in request body
 */
export function validateRequiredFields(
  body: Record<string, unknown>,
  requiredFields: string[]
): ValidationResult {
  const errors: ValidationError[] = [];

  for (const field of requiredFields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      errors.push({
        field,
        message: `Field '${field}' is required`,
        code: 'REQUIRED_FIELD_MISSING'
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate field types
 */
export function validateFieldTypes(
  body: Record<string, unknown>,
  fieldTypes: Record<string, 'string' | 'number' | 'boolean' | 'array' | 'object'>
): ValidationResult {
  const errors: ValidationError[] = [];

  for (const [field, expectedType] of Object.entries(fieldTypes)) {
    const value = body[field];
    
    if (value === undefined || value === null) {
      continue; // Skip validation for optional fields
    }

    let isValid = false;
    
    switch (expectedType) {
      case 'string':
        isValid = typeof value === 'string';
        break;
      case 'number':
        isValid = typeof value === 'number' && !isNaN(value);
        break;
      case 'boolean':
        isValid = typeof value === 'boolean';
        break;
      case 'array':
        isValid = Array.isArray(value);
        break;
      case 'object':
        isValid = typeof value === 'object' && !Array.isArray(value);
        break;
    }

    if (!isValid) {
      errors.push({
        field,
        message: `Field '${field}' must be of type '${expectedType}'`,
        code: 'INVALID_TYPE'
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate numeric ranges
 */
export function validateNumericRanges(
  body: Record<string, unknown>,
  ranges: Record<string, { min?: number; max?: number }>
): ValidationResult {
  const errors: ValidationError[] = [];

  for (const [field, range] of Object.entries(ranges)) {
    const value = body[field];
    
    if (value === undefined || value === null) {
      continue; // Skip validation for optional fields
    }

    if (typeof value !== 'number') {
      continue; // Skip if not a number (should be caught by type validation)
    }

    if (range.min !== undefined && value < range.min) {
      errors.push({
        field,
        message: `Field '${field}' must be at least ${range.min}`,
        code: 'VALUE_TOO_LOW'
      });
    }

    if (range.max !== undefined && value > range.max) {
      errors.push({
        field,
        message: `Field '${field}' must be at most ${range.max}`,
        code: 'VALUE_TOO_HIGH'
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate string lengths
 */
export function validateStringLengths(
  body: Record<string, unknown>,
  lengths: Record<string, { min?: number; max?: number }>
): ValidationResult {
  const errors: ValidationError[] = [];

  for (const [field, length] of Object.entries(lengths)) {
    const value = body[field];
    
    if (value === undefined || value === null) {
      continue; // Skip validation for optional fields
    }

    if (typeof value !== 'string') {
      continue; // Skip if not a string (should be caught by type validation)
    }

    if (length.min !== undefined && value.length < length.min) {
      errors.push({
        field,
        message: `Field '${field}' must be at least ${length.min} characters`,
        code: 'STRING_TOO_SHORT'
      });
    }

    if (length.max !== undefined && value.length > length.max) {
      errors.push({
        field,
        message: `Field '${field}' must be at most ${length.max} characters`,
        code: 'STRING_TOO_LONG'
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate enum values
 */
export function validateEnumValues(
  body: Record<string, unknown>,
  enums: Record<string, string[]>
): ValidationResult {
  const errors: ValidationError[] = [];

  for (const [field, allowedValues] of Object.entries(enums)) {
    const value = body[field];
    
    if (value === undefined || value === null) {
      continue; // Skip validation for optional fields
    }

    if (typeof value !== 'string' || !allowedValues.includes(value)) {
      errors.push({
        field,
        message: `Field '${field}' must be one of: ${allowedValues.join(', ')}`,
        code: 'INVALID_ENUM_VALUE'
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate UUIDs
 */
export function validateUUIDs(
  body: Record<string, unknown>,
  uuidFields: string[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  for (const field of uuidFields) {
    const value = body[field];
    
    if (value === undefined || value === null) {
      continue; // Skip validation for optional fields
    }

    if (typeof value !== 'string' || !uuidRegex.test(value)) {
      errors.push({
        field,
        message: `Field '${field}' must be a valid UUID`,
        code: 'INVALID_UUID'
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate email addresses
 */
export function validateEmails(
  body: Record<string, unknown>,
  emailFields: string[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (const field of emailFields) {
    const value = body[field];
    
    if (value === undefined || value === null) {
      continue; // Skip validation for optional fields
    }

    if (typeof value !== 'string' || !emailRegex.test(value)) {
      errors.push({
        field,
        message: `Field '${field}' must be a valid email address`,
        code: 'INVALID_EMAIL'
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate dates
 */
export function validateDates(
  body: Record<string, unknown>,
  dateFields: string[]
): ValidationResult {
  const errors: ValidationError[] = [];

  for (const field of dateFields) {
    const value = body[field];
    
    if (value === undefined || value === null) {
      continue; // Skip validation for optional fields
    }

    if (typeof value !== 'string') {
      errors.push({
        field,
        message: `Field '${field}' must be a valid date string`,
        code: 'INVALID_DATE_FORMAT'
      });
      continue;
    }

    const date = new Date(value);
    if (isNaN(date.getTime())) {
      errors.push({
        field,
        message: `Field '${field}' must be a valid date`,
        code: 'INVALID_DATE'
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Comprehensive validation function
 */
export interface ValidationConfig {
  required?: string[];
  types?: Record<string, 'string' | 'number' | 'boolean' | 'array' | 'object'>;
  ranges?: Record<string, { min?: number; max?: number }>;
  lengths?: Record<string, { min?: number; max?: number }>;
  enums?: Record<string, string[]>;
  uuids?: string[];
  emails?: string[];
  dates?: string[];
}

export function validateRequestBody(
  body: Record<string, unknown>,
  config: ValidationConfig
): ValidationResult {
  const allErrors: ValidationError[] = [];

  if (config.required) {
    const result = validateRequiredFields(body, config.required);
    allErrors.push(...result.errors);
  }

  if (config.types) {
    const result = validateFieldTypes(body, config.types);
    allErrors.push(...result.errors);
  }

  if (config.ranges) {
    const result = validateNumericRanges(body, config.ranges);
    allErrors.push(...result.errors);
  }

  if (config.lengths) {
    const result = validateStringLengths(body, config.lengths);
    allErrors.push(...result.errors);
  }

  if (config.enums) {
    const result = validateEnumValues(body, config.enums);
    allErrors.push(...result.errors);
  }

  if (config.uuids) {
    const result = validateUUIDs(body, config.uuids);
    allErrors.push(...result.errors);
  }

  if (config.emails) {
    const result = validateEmails(body, config.emails);
    allErrors.push(...result.errors);
  }

  if (config.dates) {
    const result = validateDates(body, config.dates);
    allErrors.push(...result.errors);
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors
  };
}

/**
 * Sanitize input string
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/[<>]/g, ''); // Remove potential HTML tags
}

/**
 * Sanitize object properties
 */
export function sanitizeObject(obj: Record<string, unknown>, stringFields: string[]): Record<string, unknown> {
  const sanitized = { ...obj };

  for (const field of stringFields) {
    if (sanitized[field] && typeof sanitized[field] === 'string') {
      sanitized[field] = sanitizeString(sanitized[field]);
    }
  }

  return sanitized;
}

/**
 * Validate positive integer
 */
export function validatePositiveInteger(value: unknown, fieldName: string): ValidationResult {
  const errors: ValidationError[] = [];

  if (value === undefined || value === null) {
    return { isValid: true, errors: [] }; // Optional field
  }

  let numValue: number;
  if (typeof value === 'string') {
    numValue = parseInt(value);
  } else if (typeof value === 'number') {
    numValue = value;
  } else {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be a positive integer`,
      code: 'INVALID_POSITIVE_INTEGER'
    });
    return { isValid: false, errors };
  }
  
  if (isNaN(numValue) || numValue <= 0 || !Number.isInteger(numValue)) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be a positive integer`,
      code: 'INVALID_POSITIVE_INTEGER'
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate ID parameter from URL
 */
export function validateIdParam(id: string, paramName: string = 'id'): ValidationResult {
  const errors: ValidationError[] = [];

  if (!id) {
    errors.push({
      field: paramName,
      message: `${paramName} parameter is required`,
      code: 'MISSING_ID_PARAM'
    });
    return { isValid: false, errors };
  }

  const numId = parseInt(id);
  if (isNaN(numId) || numId <= 0) {
    errors.push({
      field: paramName,
      message: `${paramName} must be a positive integer`,
      code: 'INVALID_ID_PARAM'
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Create validation error messages for API responses
 */
export function formatValidationErrors(errors: ValidationError[]): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  for (const error of errors) {
    if (!formatted[error.field]) {
      formatted[error.field] = [];
    }
    formatted[error.field].push(error.message);
  }

  return formatted;
} 