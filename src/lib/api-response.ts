/**
 * API 响应优化工具
 * 提供响应压缩、字段过滤、分页等通用功能
 */

import { NextResponse } from "next/server";

interface PaginationOptions {
  page?: number;
  pageSize?: number;
  defaultPageSize?: number;
  maxPageSize?: number;
}

interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * 解析分页参数
 */
export function parsePagination(
  url: URL,
  options: PaginationOptions = {}
): { page: number; pageSize: number; skip: number; take: number } {
  const {
    defaultPageSize = 20,
    maxPageSize = 100,
  } = options;

  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const requestedSize = parseInt(
    url.searchParams.get("pageSize") || String(defaultPageSize),
    10
  );
  const pageSize = Math.min(maxPageSize, Math.max(1, requestedSize || defaultPageSize));

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

/**
 * 创建分页响应
 */
export function paginatedResponse<T>(
  data: T[],
  page: number,
  pageSize: number,
  total: number
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / pageSize);
  return {
    data,
    meta: {
      page,
      pageSize,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

/**
 * 字段过滤工具
 * 仅返回客户端请求的字段，减少响应大小
 */
export function filterFields<T extends Record<string, unknown>>(
  obj: T,
  fields: string[] | undefined
): Partial<T> {
  if (!fields || fields.length === 0) return obj;

  const result: Partial<T> = {};
  for (const field of fields) {
    if (field in obj) {
      result[field as keyof T] = obj[field as keyof T];
    }
  }
  return result;
}

/**
 * 解析字段查询参数
 */
export function parseFields(url: URL): string[] | undefined {
  const fieldsParam = url.searchParams.get("fields");
  if (!fieldsParam) return undefined;
  return fieldsParam.split(",").map((f) => f.trim()).filter(Boolean);
}

/**
 * 创建带缓存头的响应
 */
export function cachedResponse<T>(
  data: T,
  options: {
    maxAge?: number; // 浏览器缓存时间（秒）
    sMaxAge?: number; // CDN 缓存时间（秒）
    staleWhileRevalidate?: number; // 后台重新验证时间（秒）
    private?: boolean;
  } = {}
): NextResponse {
  const {
    maxAge = 60,
    sMaxAge,
    staleWhileRevalidate,
    private: isPrivate = false,
  } = options;

  const cacheControl: string[] = [
    isPrivate ? "private" : "public",
    `max-age=${maxAge}`,
  ];

  if (sMaxAge !== undefined) {
    cacheControl.push(`s-maxage=${sMaxAge}`);
  }

  if (staleWhileRevalidate !== undefined) {
    cacheControl.push(`stale-while-revalidate=${staleWhileRevalidate}`);
  }

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": cacheControl.join(", "),
    },
  });
}

/**
 * 创建错误响应
 */
export function errorResponse(
  message: string,
  status: number = 500,
  details?: unknown
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      ...(details !== undefined && { details }),
    },
    { status }
  );
}

/**
 * 排序参数解析
 */
export function parseSort(
  url: URL,
  allowedFields: string[]
): Record<string, "asc" | "desc"> | undefined {
  const sortParam = url.searchParams.get("sort");
  if (!sortParam) return undefined;

  const result: Record<string, "asc" | "desc"> = {};

  for (const field of sortParam.split(",")) {
    const trimmed = field.trim();
    const isDesc = trimmed.startsWith("-");
    const fieldName = isDesc ? trimmed.slice(1) : trimmed;

    if (allowedFields.includes(fieldName)) {
      result[fieldName] = isDesc ? "desc" : "asc";
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}
