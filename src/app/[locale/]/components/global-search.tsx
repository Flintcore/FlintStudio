"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Folder, Film, User, MapPin, Loader2 } from "lucide-react";
import { useDebounce } from "@/lib/hooks/use-performance";

interface SearchResult {
  projects: Array<{
    id: string;
    name: string;
    description: string | null;
    type: "project";
    url: string;
    updatedAt: Date;
  }>;
  episodes: Array<{
    id: string;
    name: string;
    episodeNumber: number;
    type: "episode";
    url: string;
    projectName: string;
  }>;
  characters: Array<{
    id: string;
    name: string;
    type: "character";
    url: string;
    projectName: string;
    hasVoice: boolean;
  }>;
  locations: Array<{
    id: string;
    name: string;
    type: "location";
    summary: string | null;
    url: string;
    projectName: string;
  }>;
}

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const search = useCallback(async (searchQuery: unknown) => {
    const queryStr = String(searchQuery);
    if (!queryStr || queryStr.length < 2) {
      setResults(null);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(queryStr)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 聚焦输入框
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (url: string) => {
    setIsOpen(false);
    setQuery("");
    setResults(null);
    router.push(url);
  };

  const totalResults =
    (results?.projects.length || 0) +
    (results?.episodes.length || 0) +
    (results?.characters.length || 0) +
    (results?.locations.length || 0);

  return (
    <>
      {/* 搜索按钮 */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent)]/30 transition-smooth"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">搜索...</span>
        <kbd className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--muted)]/10 text-xs">
          <span>Ctrl</span>
          <span>K</span>
        </kbd>
      </button>

      {/* 搜索弹窗 */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
          <div className="relative w-full max-w-2xl mx-4 bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-2xl overflow-hidden">
            {/* 搜索输入 */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
              <Search className="h-5 w-5 text-[var(--muted)]" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索项目、剧集、角色、场景..."
                className="flex-1 bg-transparent outline-none text-[var(--foreground)] placeholder:text-[var(--muted)]"
              />
              {loading && <Loader2 className="h-4 w-4 animate-spin text-[var(--muted)]" />}
              <button
                onClick={() => {
                  setQuery("");
                  setResults(null);
                }}
                className="p-1 rounded hover:bg-[var(--muted)]/10"
              >
                <X className="h-4 w-4 text-[var(--muted)]" />
              </button>
            </div>

            {/* 搜索结果 */}
            <div className="max-h-[60vh] overflow-y-auto">
              {query.length > 0 && query.length < 2 && (
                <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">
                  输入至少 2 个字符开始搜索
                </p>
              )}

              {results && totalResults === 0 && query.length >= 2 && (
                <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">
                  未找到相关内容
                </p>
              )}

              {results?.projects && results.projects.length > 0 && (
                <div className="px-2 py-2">
                  <h3 className="px-2 py-1 text-xs font-medium text-[var(--muted)] uppercase">
                    项目
                  </h3>
                  {results.projects.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item.url)}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[var(--accent)]/5 text-left"
                    >
                      <Folder className="h-4 w-4 text-[var(--accent)]" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.name}</p>
                        {item.description && (
                          <p className="text-sm text-[var(--muted)] truncate">{item.description}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results?.episodes && results.episodes.length > 0 && (
                <div className="px-2 py-2 border-t border-[var(--border)]">
                  <h3 className="px-2 py-1 text-xs font-medium text-[var(--muted)] uppercase">
                    剧集
                  </h3>
                  {results.episodes.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item.url)}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[var(--accent)]/5 text-left"
                    >
                      <Film className="h-4 w-4 text-[var(--accent)]" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.name}</p>
                        <p className="text-sm text-[var(--muted)]">{item.projectName}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results?.characters && results.characters.length > 0 && (
                <div className="px-2 py-2 border-t border-[var(--border)]">
                  <h3 className="px-2 py-1 text-xs font-medium text-[var(--muted)] uppercase">
                    角色
                  </h3>
                  {results.characters.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item.url)}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[var(--accent)]/5 text-left"
                    >
                      <User className="h-4 w-4 text-[var(--accent)]" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.name}</p>
                        <p className="text-sm text-[var(--muted)]">
                          {item.projectName}
                          {item.hasVoice && (
                            <span className="ml-1 text-[var(--accent)]">· 已配音</span>
                          )}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {results?.locations && results.locations.length > 0 && (
                <div className="px-2 py-2 border-t border-[var(--border)]">
                  <h3 className="px-2 py-1 text-xs font-medium text-[var(--muted)] uppercase">
                    场景
                  </h3>
                  {results.locations.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item.url)}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[var(--accent)]/5 text-left"
                    >
                      <MapPin className="h-4 w-4 text-[var(--accent)]" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.name}</p>
                        <p className="text-sm text-[var(--muted)] truncate">
                          {item.summary || item.projectName}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
