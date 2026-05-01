/**
 * API 输入验证工具
 * 统一的请求体验证和清理
 */

import { logger } from "./logger";

interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

interface ValidationRules {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  enum?: string[];
  type?: "string" | "number" | "boolean" | "array" | "object";
  min?: number;
  max?: number;
  custom?: (value: unknown) => boolean | string;
}

/**
 * 验证单个字段
 */
function validateField(
  value: unknown,
  rules: ValidationRules,
  fieldName: string
): string | null {
  // 必填检查
  if (rules.required && (value === undefined || value === null || value === "")) {
    return `${fieldName} 不能为空`;
  }

  if (value === undefined || value === null) return null;

  // 类型检查
  if (rules.type) {
    const actualType = Array.isArray(value) ? "array" : typeof value;
    if (actualType !== rules.type) {
      return `${fieldName} 类型错误，期望 ${rules.type}，实际 ${actualType}`;
    }
  }

  // 字符串检查
  if (typeof value === "string") {
    if (rules.minLength && value.length < rules.minLength) {
      return `${fieldName} 长度不能少于 ${rules.minLength} 个字符`;
    }
    if (rules.maxLength && value.length > rules.maxLength) {
      return `${fieldName} 长度不能超过 ${rules.maxLength} 个字符`;
    }
    if (rules.pattern && !rules.pattern.test(value)) {
      return `${fieldName} 格式不正确`;
    }
    if (rules.enum && !rules.enum.includes(value)) {
      return `${fieldName} 必须是以下之一: ${rules.enum.join(", ")}`;
    }
  }

  // 数值检查
  if (typeof value === "number") {
    if (rules.min && value < rules.min) {
      return `${fieldName} 不能小于 ${rules.min}`;
    }
    if (rules.max && value > rules.max) {
      return `${fieldName} 不能大于 ${rules.max}`;
    }
  }

  // 自定义验证
  if (rules.custom) {
    const result = rules.custom(value);
    if (result !== true) {
      return typeof result === "string" ? result : `${fieldName} 验证失败`;
    }
  }

  return null;
}

/**
 * 验证对象
 */
export function validateObject<T extends Record<string, unknown>>(
  data: unknown,
  schema: Record<keyof T, ValidationRules>
): ValidationResult<T> {
  if (typeof data !== "object" || data === null) {
    return { success: false, errors: ["请求体必须是对象"] };
  }

  const errors: string[] = [];
  const validatedData: Record<string, unknown> = {};

  for (const [key, rules] of Object.entries(schema)) {
    const value = (data as Record<string, unknown>)[key];
    const error = validateField(value, rules, key);

    if (error) {
      errors.push(error);
    } else if (value !== undefined) {
      validatedData[key] = value;
    }
  }

  if (errors.length > 0) {
    logger.warn({ type: "validation_failed", errors }, "Validation failed");
    return { success: false, errors };
  }

  return { success: true, data: validatedData as T };
}

/**
 * 清理字符串（防止 XSS）
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/**
 * 验证 UUID 格式
 */
export function isValidUUID(str: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * 验证 URL 格式
 */
export function isValidURL(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * 验证邮箱格式
 */
export function isValidEmail(str: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(str);
}

/**
 * 常见验证模式
 */
export const validationPatterns = {
  // 只允许字母、数字、下划线、连字符
  safeString: /^[\w\-]+$/,
  // 项目名：字母开头，允许字母数字下划线连字符
  projectName: /^[a-zA-Z][\w\-]*$/,
  // API Key：字母数字和常见符号
  apiKey: /^[a-zA-Z0-9_\-]+$/,
  // 仅限中文、英文、数字
  chineseOrEnglish: /^[\u4e00-\u9fa5a-zA-Z0-9\s]+$/,
};

/**
 * 项目创建验证 Schema
 */
export const projectCreateSchema = {
  name: {
    required: true,
    type: "string" as const,
    minLength: 1,
    maxLength: 100,
    custom: (value: unknown) => {
      const str = String(value);
      if (!validationPatterns.projectName.test(str)) {
        return "项目名称只能包含字母、数字、下划线和连字符，且必须以字母开头";
      }
      return true;
    },
  },
  description: {
    type: "string" as const,
    maxLength: 500,
  },
};

/**
 * 工作流运行验证 Schema
 */
export const workflowRunSchema = {
  projectId: {
    required: true,
    type: "string" as const,
    custom: (value: unknown) => {
      if (!isValidUUID(String(value))) {
        return "项目 ID 格式不正确";
      }
      return true;
    },
  },
  novelText: {
    required: true,
    type: "string" as const,
    minLength: 10,
    maxLength: 100000,
  },
};

/**
 * API 配置验证 Schema
 */
export const apiConfigSchema = {
  llmBaseUrl: {
    type: "string" as const,
    custom: (value: unknown) => {
      if (value && !isValidURL(String(value))) {
        return "LLM Base URL 格式不正确";
      }
      return true;
    },
  },
  llmApiKey: {
    type: "string" as const,
    maxLength: 500,
  },
  videoBaseUrl: {
    type: "string" as const,
    custom: (value: unknown) => {
      if (value && !isValidURL(String(value))) {
        return "视频 Base URL 格式不正确";
      }
      return true;
    },
  },
  videoApiKey: {
    type: "string" as const,
    maxLength: 500,
  },
};
