/**
 * FlintStudio Control Skill - 入口文件
 * 
 * 用于 IM 平台控制 FlintStudio 核心业务功能
 */

export { FlintStudioClient } from "./api-client";
export {
  setServer,
  getServer,
  setToken,
  showHelp,
  createProject,
  listProjects,
  deleteProject,
  startWorkflow,
  listWorkflows,
  checkStatus,
  continueWorkflow,
  retryAnalyze,
  getResult,
  configureApi,
  getConfig,
  testConnection,
  parseCommand,
  execute,
} from "./control";

// 默认导出
import control from "./control";
export default control;
