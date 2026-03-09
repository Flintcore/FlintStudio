/**
 * FlintStudio API 客户端
 * 封装对 FlintStudio API 的调用，处理认证和错误
 */

export interface Project {
  id: string;
  name: string;
  description?: string;
  mode: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: "queued" | "running" | "completed" | "failed" | "canceled";
  currentPhase?: string;
  errorMessage?: string;
  queuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  stepsCount: number;
}

export interface WorkflowRunDetail {
  id: string;
  workflowId: string;
  status: string;
  currentPhase?: string;
  errorMessage?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  steps: WorkflowStep[];
  queuedAt: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface WorkflowStep {
  stepKey: string;
  stepTitle: string;
  status: "pending" | "running" | "completed" | "failed";
  startedAt?: string;
  finishedAt?: string;
  result?: Record<string, unknown>;
  payload?: Record<string, unknown>;
}

export interface Episode {
  id: string;
  episodeNumber: number;
  name: string;
  novelText?: string;
  audioUrl?: string;
  videoUrl?: string;
  srtContent?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiConfig {
  llmBaseUrl: string;
  llmApiKey: string;
  imageBaseUrl: string;
  imageApiKey: string;
  ttsBaseUrl: string;
  ttsApiKey: string;
  videoBaseUrl?: string;
  videoApiKey?: string;
  analysisModel?: string;
  storyboardModel?: string;
  videoModel?: string;
  providers?: unknown[];
  defaults?: Record<string, string>;
}

export interface ApiError {
  error: string;
  status: number;
}

export class FlintStudioClient {
  private baseUrl: string;
  private token?: string;

  constructor(baseUrl = "http://localhost:13000", token?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, "");
  }

  setToken(token: string): void {
    this.token = token;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/api${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const error: ApiError = {
          error: data?.error || `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
        };
        throw error;
      }

      return data as T;
    } catch (err) {
      if ((err as ApiError).status) {
        throw err;
      }
      throw {
        error: err instanceof Error ? err.message : "网络请求失败",
        status: 0,
      };
    }
  }

  // ==================== 项目 API ====================

  /**
   * 创建新项目
   */
  async createProject(name?: string): Promise<Project> {
    const query = name ? `?name=${encodeURIComponent(name)}` : "";
    // 创建项目接口返回重定向，我们需要特殊处理
    const response = await this.request<{ id: string; name: string }>(
      `/projects/create${query}`,
      { method: "GET" }
    );
    return response as unknown as Project;
  }

  /**
   * 列出所有项目
   */
  async listProjects(): Promise<Project[]> {
    return this.request<Project[]>("/projects");
  }

  /**
   * 获取项目详情
   */
  async getProject(projectId: string): Promise<Project> {
    return this.request<Project>(`/projects/${projectId}`);
  }

  /**
   * 删除项目
   */
  async deleteProject(projectId: string): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>(`/projects/${projectId}`, {
      method: "DELETE",
    });
  }

  // ==================== 工作流 API ====================

  /**
   * 启动工作流
   */
  async startWorkflow(
    projectId: string,
    novelText: string,
    visualStyle?: string
  ): Promise<{
    runId: string;
    status: string;
    message: string;
  }> {
    return this.request("/workflows/run", {
      method: "POST",
      body: JSON.stringify({
        projectId,
        novelText,
        visualStyle,
      }),
    });
  }

  /**
   * 列出工作流运行记录
   */
  async listWorkflows(params?: {
    projectId?: string;
    status?: string;
    limit?: number;
  }): Promise<{ runs: WorkflowRun[] }> {
    const query = new URLSearchParams();
    if (params?.projectId) query.append("projectId", params.projectId);
    if (params?.status) query.append("status", params.status);
    if (params?.limit) query.append("limit", String(params.limit));

    return this.request<{ runs: WorkflowRun[] }>(
      `/workflows/runs?${query.toString()}`
    );
  }

  /**
   * 获取工作流运行详情
   */
  async getWorkflowRun(runId: string): Promise<WorkflowRunDetail> {
    return this.request<WorkflowRunDetail>(`/workflows/runs/${runId}`);
  }

  /**
   * 继续工作流（复查通过后）
   */
  async continueWorkflow(runId: string): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>(`/workflows/runs/${runId}/continue`, {
      method: "POST",
    });
  }

  /**
   * 重试剧本分析
   */
  async retryAnalyze(runId: string): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>(`/workflows/runs/${runId}/retry-analyze`, {
      method: "POST",
    });
  }

  // ==================== 剧集 API ====================

  /**
   * 获取剧集详情
   */
  async getEpisode(projectId: string, episodeNumber: number): Promise<Episode> {
    // 注意：这里需要根据实际 API 调整
    return this.request<Episode>(
      `/projects/${projectId}/episodes/${episodeNumber}`
    );
  }

  // ==================== 配置 API ====================

  /**
   * 获取当前 API 配置
   */
  async getApiConfig(): Promise<ApiConfig> {
    return this.request<ApiConfig>("/settings/api-config");
  }

  /**
   * 更新 API 配置
   */
  async updateApiConfig(config: Partial<ApiConfig>): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>("/settings/api-config", {
      method: "POST",
      body: JSON.stringify(config),
    });
  }

  // ==================== 系统 API ====================

  /**
   * 测试连接
   */
  async testConnection(): Promise<{ ok: boolean; version?: string }> {
    try {
      // 尝试访问设置 API 作为连接测试
      await this.getApiConfig();
      return { ok: true };
    } catch (err) {
      const error = err as ApiError;
      if (error.status === 401) {
        return { ok: true }; // 需要认证说明服务器在线
      }
      throw error;
    }
  }
}

// 导出单例实例
export const defaultClient = new FlintStudioClient();

export default FlintStudioClient;
