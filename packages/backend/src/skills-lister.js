// 列出已加载的 skills（用于验证扩展点 / 调试）
// 复用 buildLoader，只读不建会话
import { buildLoader } from "./loader.js";

export async function listSkills(cfg) {
  const { loader } = await buildLoader(cfg);
  const { skills, diagnostics } = loader.getSkills();
  return {
    count: skills.length,
    skills: skills.map((s) => ({ name: s.name, description: s.description })),
    diagnostics: diagnostics.map((d) => ({
      severity: d.severity,
      message: d.message,
      path: d.path,
    })),
    systemPrompt: loader.getSystemPrompt()?.slice(0, 500),
  };
}
