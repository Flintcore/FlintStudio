"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, RotateCcw, Save, FileText } from "lucide-react";

interface PromptConfig {
  analyzeNovelSystem: string;
  storyToScriptSystem: string;
  scriptToStoryboardSystem: string;
  voiceExtractSystem: string;
}

const DEFAULT_PROMPTS: PromptConfig = {
  analyzeNovelSystem: `你是一位资深的剧本分析专家，擅长从小说或剧本原文中提取结构化信息，包括角色、场景和剧情结构。

## 任务
分析用户提供的小说/剧本内容，提取以下信息：
1. **角色信息**：所有出场角色的名称、描述、性格特点
2. **场景信息**：故事发生的主要地点/场景
3. **剧情结构**：将故事合理划分为多集，每集有完整的起承转合

## 输出格式（严格 JSON）
{\n  "characters": [{"name": "角色名", "description": "描述", "traits": ["特点1"]}],
  "locations": [{"name": "场景名", "description": "描述"}],
  "episodes": [{"episodeNumber": 1, "title": "标题", "summary": "摘要", "content": "内容"}]
}`,

  storyToScriptSystem: `你是一位专业的分场编剧，擅长将整集剧本拆解为结构清晰的场次。

## 任务
根据用户提供的单集剧本文本，拆分为多个「场」(clip)。

## 输出格式（严格 JSON）
{\n  "clips": [{\n    "summary": "本场一句话摘要（15-30字）",\n    "location": "场景名",\n    "characters": ["角色A"],\n    "content": "本场完整正文内容"\n  }]\n}`,

  scriptToStoryboardSystem: `你是一位资深分镜师，擅长将剧本内容拆解为专业的分镜头脚本。

## 任务
根据一场戏的 content，拆分为多个镜头(panel)。

## 输出格式（严格 JSON）
{\n  "panels": [{\n    "description": "画面描述（包含：人物、动作、景别）",\n    "imagePrompt": "用于AI绘图的英文提示词，30-80词",\n    "location": "场景名",\n    "characters": ["角色名"]\n  }]\n}`,

  voiceExtractSystem: `你是一位专业的配音导演，擅长从剧本中提取所有需要配音的内容。

## 任务
提取所有需要配音的句子（对白、旁白、内心独白）。

## 输出格式（严格 JSON）
{\n  "lines": [{\n    "speaker": "说话人角色名或旁白/Narrator",\n    "content": "该句完整文本"\n  }]\n}`,
};

const PROMPT_LABELS: Record<keyof PromptConfig, string> = {
  analyzeNovelSystem: "📖 剧本分析提示词",
  storyToScriptSystem: "🎬 分场提示词",
  scriptToStoryboardSystem: "🎞️ 分镜提示词",
  voiceExtractSystem: "🎙️ 配音提取提示词",
};

const PROMPT_DESCRIPTIONS: Record<keyof PromptConfig, string> = {
  analyzeNovelSystem: "用于分析小说/剧本，提取角色、场景和分集结构",
  storyToScriptSystem: "用于将单集剧本拆分为多个场次",
  scriptToStoryboardSystem: "用于将场次拆分为分镜镜头",
  voiceExtractSystem: "用于提取需要配音的台词和旁白",
};

export function PromptConfigForm() {
  const [prompts, setPrompts] = useState<PromptConfig>(DEFAULT_PROMPTS);
  const [customPrompts, setCustomPrompts] = useState<Partial<PromptConfig>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings/prompts")
      .then((r) => r.json())
      .then((data) => {
        if (data.prompts) {
          setCustomPrompts(data.prompts);
          // 合并默认值和自定义值
          setPrompts((prev) => ({
            ...prev,
            ...data.prompts,
          }));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleChange = (key: keyof PromptConfig, value: string) => {
    setPrompts((prev) => ({ ...prev, [key]: value }));
    setCustomPrompts((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = (key: keyof PromptConfig) => {
    setPrompts((prev) => ({ ...prev, [key]: DEFAULT_PROMPTS[key] }));
    setCustomPrompts((prev) => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customPrompts),
      });
      if (!res.ok) throw new Error("保存失败");
      setMessage({ type: "success", text: "提示词已保存" });
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: "error", text: "保存失败，请重试" });
    } finally {
      setSaving(false);
    }
  };

  const toggleExpand = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="card-base mt-6 p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="card-base mt-6 p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
          <FileText className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-[var(--foreground)]">提示词配置</h3>
          <p className="text-sm text-[var(--muted)]">
            自定义 AI 工作流各阶段的 System Prompt。如不填写，将使用默认提示词。
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {(Object.keys(DEFAULT_PROMPTS) as Array<keyof PromptConfig>).map((key) => {
          const isCustom = key in customPrompts;
          const isExpanded = expanded[key];

          return (
            <div
              key={key}
              className={`border rounded-xl overflow-hidden transition-colors ${
                isCustom
                  ? "border-[var(--accent)]/30 bg-[var(--accent)]/5"
                  : "border-[var(--border)]"
              }`}
            >
              <button
                onClick={() => toggleExpand(key)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-[var(--muted)]/5 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[var(--foreground)]">
                      {PROMPT_LABELS[key]}
                    </span>
                    {isCustom && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
                        已自定义
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--muted)] mt-0.5">
                    {PROMPT_DESCRIPTIONS[key]}
                  </p>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5 text-[var(--muted)]" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-[var(--muted)]" />
                )}
              </button>

              {isExpanded && (
                <div className="px-4 pb-4">
                  <textarea
                    value={prompts[key]}
                    onChange={(e) => handleChange(key, e.target.value)}
                    className="w-full h-64 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
                    placeholder={`输入自定义 ${PROMPT_LABELS[key]}...`}
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={() => handleReset(key)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                    >
                      <RotateCcw className="h-4 w-4" />
                      恢复默认
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {message && (
        <div
          className={`mt-4 p-3 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-500/10 text-green-600"
              : "bg-red-500/10 text-red-600"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] transition-smooth disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="h-4 w-4" />
          {saving ? "保存中…" : "保存提示词"}
        </button>
      </div>
    </div>
  );
}
