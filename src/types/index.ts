export type AppName = "edulter";

/**
 * 统一的 ID 类型别名，便于在服务层清晰表达意图。
 */
export type Id = string;

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

/**
 * 后端 service 层返回统一的列表结果骨架。
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

