/**
 * Golden Hook Generator
 * Creates viral opening hooks for the first 10 seconds
 */

export interface HookTemplate {
  type: 'conflict' | 'suspense' | 'contrast' | 'emotion';
  template: string;
  effectiveness: number; // 0-100
  usage: number; // usage count
}

// 基于 10 万字知识库的黄金钩子模板
const hookTemplates: HookTemplate[] = [
  {
    type: 'conflict',
    template: '"{character}，你这个{insult}，{action}!"',
    effectiveness: 95,
    usage: 0,
  },
  {
    type: 'suspense',
    template: '"{time}后，{character}带着{secret}回来了..."',
    effectiveness: 92,
    usage: 0,
  },
  {
    type: 'contrast',
    template: '{character}怎么也想不到，眼前这个{description}竟然是{reality}',
    effectiveness: 90,
    usage: 0,
  },
  {
    type: 'emotion',
    template: '"我为你付出了{price}，你竟然{action}!"',
    effectiveness: 88,
    usage: 0,
  },
  {
    type: 'conflict',
    template: '今天是我和{character}的{event}，也是我{action}的日子',
    effectiveness: 87,
    usage: 0,
  },
  {
    type: 'suspense',
    template: '所有人都以为{character}已经{state}，直到{event}发生...',
    effectiveness: 93,
    usage: 0,
  },
  {
    type: 'contrast',
    template: '三年前{character}{action_a}，三年后{action_b}',
    effectiveness: 91,
    usage: 0,
  },
  {
    type: 'emotion',
    template: '"你以为{belief}？真相是{truth}!"',
    effectiveness: 89,
    usage: 0,
  },
];

/**
 * 生成黄金钩子
 */
export function generateGoldenHook(genre: string, themes: string[]): string {
  // 根据类型和主题选择最佳钩子模板
  const suitableHooks = hookTemplates.filter(h => {
    if (genre === 'urban-power' && h.type === 'contrast') return true;
    if (genre === 'sweet-romance' && h.type === 'emotion') return true;
    if (genre === 'revenge' && h.type === 'conflict') return true;
    return true;
  });
  
  // 按效果排序，选择最佳
  const bestHook = suitableHooks.sort((a, b) => b.effectiveness - a.effectiveness)[0];
  
  // 增加使用计数
  bestHook.usage++;
  
  // 填充变量
  return fillHookTemplate(bestHook.template, genre, themes);
}

/**
 * 填充钩子模板
 */
function fillHookTemplate(template: string, genre: string, themes: string[]): string {
  const variables: Record<string, string> = {
    character: getCharacterForGenre(genre),
    insult: getInsultForGenre(genre),
    action: getActionForGenre(genre),
    time: getTimePhrase(),
    secret: getSecretForThemes(themes),
    description: getDescriptionForGenre(genre),
    reality: getRealityForGenre(genre),
    price: getPriceForGenre(genre),
    event: getEventForGenre(genre),
    state: getStateForGenre(genre),
    belief: getBeliefForGenre(genre),
    truth: getTruthForGenre(genre),
  };
  
  let filled = template;
  Object.entries(variables).forEach(([key, value]) => {
    filled = filled.replace(new RegExp(`{${key}}`, 'g'), value);
  });
  
  return filled;
}

// 辅助函数
function getCharacterForGenre(genre: string): string {
  const characters: Record<string, string[]> = {
    'urban-power': ['废物赘婿', '穷小子', '送外卖的'],
    'sweet-romance': ['灰姑娘', '小白兔', '普通女孩'],
    'revenge': ['废柴', '弃妃', '罪臣之女'],
  };
  const chars = characters[genre] || ['主角'];
  return chars[Math.floor(Math.random() * chars.length)];
}

function getInsultForGenre(genre: string): string {
  const insults = ['废物', '垃圾', '没用的东西', '赔钱货'];
  return insults[Math.floor(Math.random() * insults.length)];
}

function getActionForGenre(genre: string): string {
  const actions: Record<string, string[]> = {
    'urban-power': ['给我滚', '离婚吧', '别丢人现眼了'],
    'sweet-romance': ['别做梦了', '你不配', '认清现实'],
    'revenge': ['去死吧', '付出代价', '血债血偿'],
  };
  const acts = actions[genre] || ['离开'];
  return acts[Math.floor(Math.random() * acts.length)];
}

function getTimePhrase(): string {
  const times = ['三年', '五年', '十年', '一千天'];
  return times[Math.floor(Math.random() * times.length)];
}

function getSecretForThemes(themes: string[]): string {
  if (themes.includes('hidden-identity')) return '惊天秘密';
  if (themes.includes('revenge')) return '复仇计划';
  return '改变一切的东西';
}

function getDescriptionForGenre(genre: string): string {
  const descriptions: Record<string, string[]> = {
    'urban-power': ['穷酸样', '不起眼的'],
    'sweet-romance': ['高冷', '神秘的'],
    'revenge': ['柔弱的', '被欺负的'],
  };
  const descs = descriptions[genre] || ['普通的'];
  return descs[Math.floor(Math.random() * descs.length)];
}

function getRealityForGenre(genre: string): string {
  const realities: Record<string, string[]> = {
    'urban-power': ['龙王', '战神', '首富继承人'],
    'sweet-romance': ['真命天子', '隐藏富豪'],
    'revenge': ['重生者', '绝世高手'],
  };
  const reals = realities[genre] || ['大人物'];
  return reals[Math.floor(Math.random() * reals.length)];
}

function getPriceForGenre(genre: string): string {
  const prices = ['一切', '青春', '所有积蓄', '十年光阴'];
  return prices[Math.floor(Math.random() * prices.length)];
}

function getEventForGenre(genre: string): string {
  const events: Record<string, string[]> = {
    'urban-power': ['结婚纪念日', '家族宴会', '公司年会'],
    'sweet-romance': ['第一次约会', '告白日', '重逢日'],
    'revenge': ['被逐出家门的日子', '被害那日'],
  };
  const evs = events[genre] || ['重要日子'];
  return evs[Math.floor(Math.random() * evs.length)];
}

function getStateForGenre(genre: string): string {
  const states = ['死了', '废了', '一无所有', '被打败'];
  return states[Math.floor(Math.random() * states.length)];
}

function getBeliefForGenre(genre: string): string {
  const beliefs: Record<string, string[]> = {
    'urban-power': ['我是个废物', '你赢不了'],
    'sweet-romance': ['你不爱我', '我们没可能'],
    'revenge': ['你能把我怎样', '我立于不败之地'],
  };
  const bels = beliefs[genre] || ['你是对的'];
  return bels[Math.floor(Math.random() * bels.length)];
}

function getTruthForGenre(genre: string): string {
  const truths: Record<string, string[]> = {
    'urban-power': ['我是龙王', '我掌控一切'],
    'sweet-romance': ['我一直爱你', '你就是我的唯一'],
    'revenge': ['你死定了', '我才是猎人'],
  };
  const trus = truths[genre] || ['真相大白'];
  return trus[Math.floor(Math.random() * trus.length)];
}

/**
 * 更新钩子效果评分（基于实际表现）
 */
export function updateHookEffectiveness(hookType: string, success: boolean): void {
  const hook = hookTemplates.find(h => h.type === hookType);
  if (hook) {
    // 简单的强化学习：成功增加效果分，失败减少
    if (success) {
      hook.effectiveness = Math.min(100, hook.effectiveness + 1);
    } else {
      hook.effectiveness = Math.max(0, hook.effectiveness - 1);
    }
  }
}

/**
 * 获取最佳钩子类型（基于历史数据）
 */
export function getBestHookType(): string {
  return hookTemplates.sort((a, b) => b.effectiveness - a.effectiveness)[0].type;
}
