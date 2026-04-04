import { describe, it, expect } from "vitest";

// 复制 extractJson 逻辑进行测试
function extractJson<T>(content: string): T {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // 继续尝试
  }

  const codeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/g;
  let match: RegExpExecArray | null;
  const codeBlocks: string[] = [];
  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match[1]) codeBlocks.push(match[1].trim());
  }
  for (const block of codeBlocks) {
    try {
      return JSON.parse(block) as T;
    } catch {
      // 继续尝试下一个代码块
    }
  }

  const extractStructure = (startChar: "{" | "[", endChar: "}" | "]"): T | null => {
    let startIdx = -1;
    for (let i = 0; i < content.length; i++) {
      if (content[i] === startChar) {
        startIdx = i;
        break;
      }
    }
    if (startIdx === -1) return null;

    let depth = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = startIdx; i < content.length; i++) {
      const ch = content[i];
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (ch === "\\") {
        escapeNext = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === startChar) {
        depth++;
      } else if (ch === endChar) {
        depth--;
        if (depth === 0) {
          try {
            const jsonStr = content.slice(startIdx, i + 1);
            return JSON.parse(jsonStr) as T;
          } catch {
            return null;
          }
        }
      }
    }
    return null;
  };

  const objResult = extractStructure("{", "}");
  if (objResult !== null) return objResult;
  const arrResult = extractStructure("[", "]");
  if (arrResult !== null) return arrResult;

  const cleaned = content
    .replace(/^\s*Here\s+(?:is|are)\s+(?:the|a)\s+JSON\s+(?:object|array|response)[:\s]*/i, "")
    .replace(/^\s*JSON[:\s]*/i, "")
    .replace(/\s*```\s*$/g, "")
    .trim();

  if (cleaned !== content) {
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      // 继续
    }
  }

  const preview = content.slice(0, 500).replace(/\s+/g, " ");
  throw new Error(
    `无法从 LLM 响应中提取有效 JSON。内容预览: "${preview}${content.length > 500 ? "..." : ""}"`
  );
}

describe("extractJson", () => {
  it("直接解析有效的 JSON", () => {
    const result = extractJson<{ name: string }>('{"name": "test"}');
    expect(result).toEqual({ name: "test" });
  });

  it("提取代码块中的 JSON", () => {
    const content = '```json\n{"name": "test"}\n```';
    const result = extractJson<{ name: string }>(content);
    expect(result).toEqual({ name: "test" });
  });

  it("提取带有说明文字的 JSON", () => {
    const content = 'Here is the JSON response:\n```\n{"name": "test"}\n```';
    const result = extractJson<{ name: string }>(content);
    expect(result).toEqual({ name: "test" });
  });

  it("处理字符串中的大括号", () => {
    const content = '{"code": "function() { return 1; }", "name": "test"}';
    const result = extractJson<{ code: string; name: string }>(content);
    expect(result).toEqual({ code: "function() { return 1; }", name: "test" });
  });

  it("提取嵌套的 JSON 对象", () => {
    const content = '{"outer": {"inner": "value"}}';
    const result = extractJson<{ outer: { inner: string } }>(content);
    expect(result).toEqual({ outer: { inner: "value" } });
  });

  it("处理数组", () => {
    const content = '[{"id": 1}, {"id": 2}]';
    const result = extractJson<Array<{ id: number }>>(content);
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("处理字符串中的转义引号", () => {
    const content = '{"text": "He said \\"hello\\" to me"}';
    const result = extractJson<{ text: string }>(content);
    expect(result).toEqual({ text: 'He said "hello" to me' });
  });

  it("在多个代码块中提取第一个有效的", () => {
    const content = '```\ninvalid json\n```\n```json\n{"valid": true}\n```';
    const result = extractJson<{ valid: boolean }>(content);
    expect(result).toEqual({ valid: true });
  });

  it("处理前后有空白字符的 JSON", () => {
    const content = '\n\n  {"name": "test"}  \n\n';
    const result = extractJson<{ name: string }>(content);
    expect(result).toEqual({ name: "test" });
  });

  it("无法解析时抛出错误", () => {
    expect(() => extractJson("not json at all")).toThrow();
  });
});
