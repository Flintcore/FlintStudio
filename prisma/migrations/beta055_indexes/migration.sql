-- beta0.55: 数据库性能优化索引
-- 执行此脚本添加必要的索引

-- 任务查询优化
CREATE INDEX IF NOT EXISTS idx_task_status ON Task(status);
CREATE INDEX IF NOT EXISTS idx_task_runId ON Task(runId);
CREATE INDEX IF NOT EXISTS idx_task_projectId ON Task(projectId);
CREATE INDEX IF NOT EXISTS idx_task_type_status ON Task(type, status);

-- GraphStep 查询优化
CREATE INDEX IF NOT EXISTS idx_graphStep_runId ON GraphStep(runId);
CREATE INDEX IF NOT EXISTS idx_graphStep_status ON GraphStep(status);
CREATE INDEX IF NOT EXISTS idx_graphStep_stepKey ON GraphStep(stepKey);

-- GraphRun 查询优化
CREATE INDEX IF NOT EXISTS idx_graphRun_projectId ON GraphRun(projectId);
CREATE INDEX IF NOT EXISTS idx_graphRun_status ON GraphRun(status);
CREATE INDEX IF NOT EXISTS idx_graphRun_userId ON GraphRun(userId);

-- NovelPromotionProject 查询优化
CREATE INDEX IF NOT EXISTS idx_novelPromotionProject_projectId ON NovelPromotionProject(projectId);

-- NovelPromotionEpisode 查询优化
CREATE INDEX IF NOT EXISTS idx_novelPromotionEpisode_projectId ON NovelPromotionEpisode(novelPromotionProjectId);

-- NovelPromotionClip 查询优化
CREATE INDEX IF NOT EXISTS idx_novelPromotionClip_episodeId ON NovelPromotionClip(episodeId);

-- NovelPromotionPanel 查询优化
CREATE INDEX IF NOT EXISTS idx_novelPromotionPanel_storyboardId ON NovelPromotionPanel(storyboardId);

-- Storyboard 查询优化
CREATE INDEX IF NOT EXISTS idx_storyboard_clipId ON Storyboard(clipId);

-- VoiceLine 查询优化
CREATE INDEX IF NOT EXISTS idx_voiceLine_episodeId ON VoiceLine(episodeId);

-- 复合索引优化常用查询
CREATE INDEX IF NOT EXISTS idx_task_runId_status ON Task(runId, status);
CREATE INDEX IF NOT EXISTS idx_graphStep_runId_status ON GraphStep(runId, status);

-- 全文搜索索引（如需要）
-- CREATE FULLTEXT INDEX IF NOT EXISTS idx_novelPromotionPanel_description ON NovelPromotionPanel(description);
