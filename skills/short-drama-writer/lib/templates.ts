/**
 * Genre Templates
 * Provides genre-specific story templates
 */

export interface GenreTemplate {
  id: string;
  name: string;
  description: string;
  structure: {
    setup: string;      // 开局
    conflict: string;   // 冲突
    rising: string;     // 上升
    climax: string;     // 高潮
    resolution: string; // 结局
  };
  characterArchetypes: string[];
  commonLocations: string[];
  popularThemes: string[];
  estimatedRetention: number; // %
}

const genreTemplates: Record<string, GenreTemplate> = {
  'urban-power': {
    id: 'urban-power',
    name: '都市战神/赘婿',
    description: '隐藏身份的强者被轻视后打脸全场',
    structure: {
      setup: '主角表面是废物赘婿/穷小子，被所有人看不起',
      conflict: '反派不断羞辱打压，逼主角离开/离婚',
      rising: '主角身份逐渐暴露，开始反击',
      climax: '真实身份完全揭露，震惊全场',
      resolution: '反派跪地求饶，主角掌控全局',
    },
    characterArchetypes: ['隐藏大佬', '势利眼反派', '后悔前妻', '忠诚小弟'],
    commonLocations: ['豪宅', '公司', '高级餐厅', '宴会厅'],
    popularThemes: ['扮猪吃虎', '身份反转', '打脸', '龙王', '战神'],
    estimatedRetention: 75,
  },
  'sweet-romance': {
    id: 'sweet-romance',
    name: '甜宠恋爱',
    description: '平凡女孩与霸总的甜蜜爱情故事',
    structure: {
      setup: '平凡女主偶遇霸总/男神',
      conflict: '身份差距/误会/情敌出现',
      rising: '感情升温，但总有阻碍',
      climax: '突破阻碍，确认关系',
      resolution: '甜蜜HE，撒糖',
    },
    characterArchetypes: ['小白兔女主', '高冷霸总', '恶毒女配', '助攻闺蜜'],
    commonLocations: ['公司', '咖啡厅', '男主家', '商场'],
    popularThemes: ['契约婚姻', '先婚后爱', '暗恋成真', '甜宠'],
    estimatedRetention: 70,
  },
  'revenge': {
    id: 'revenge',
    name: '重生复仇',
    description: '主角重生归来，向仇人复仇',
    structure: {
      setup: '前世被陷害致死，重生回过去',
      conflict: '仇人还在，危机重重',
      rising: '利用先知优势，布局复仇',
      climax: '逐一击败仇人',
      resolution: '大仇得报，新的人生',
    },
    characterArchetypes: ['重生女主', '前世仇人', '今生盟友', '真爱男主'],
    commonLocations: ['家族大宅', '商场', '学校', '医院'],
    popularThemes: ['重生', '复仇', '逆袭', '改变命运'],
    estimatedRetention: 78,
  },
  'time-travel': {
    id: 'time-travel',
    name: '穿越',
    description: '现代人穿越到古代/异世界',
    structure: {
      setup: '现代人穿越到古代/异世界',
      conflict: '不适应环境，遇到危险',
      rising: '利用现代知识/技能逆袭',
      climax: '在古代世界站稳脚跟',
      resolution: '找到归属，收获爱情/事业',
    },
    characterArchetypes: ['穿越者', '古代王爷', '恶毒嫡母', '忠诚丫鬟'],
    commonLocations: ['古代宫殿', '市集', '府邸', '战场'],
    popularThemes: ['穿越', '金手指', '古代生活', '权谋'],
    estimatedRetention: 72,
  },
  'suspense': {
    id: 'suspense',
    name: '悬疑',
    description: '解谜/探案/生存',
    structure: {
      setup: '神秘事件发生',
      conflict: '调查过程中危险重重',
      rising: '线索逐渐浮出水面',
      climax: '真相即将揭晓',
      resolution: '谜底揭开，罪犯伏法',
    },
    characterArchetypes: ['侦探/女主', '嫌疑人', '真凶', '受害者'],
    commonLocations: ['案发现场', '警局', '嫌疑人住所', '关键地点'],
    popularThemes: ['悬疑', '推理', '反转', '心理战'],
    estimatedRetention: 65,
  },
};

/**
 * 获取类型模板
 */
export function getGenreTemplate(genreId: string): GenreTemplate {
  return genreTemplates[genreId] || genreTemplates['urban-power'];
}

/**
 * 列出所有类型
 */
export function listGenres(): Array<{ id: string; name: string; retention: number }> {
  return Object.values(genreTemplates).map(g => ({
    id: g.id,
    name: g.name,
    retention: g.estimatedRetention,
  }));
}

/**
 * 获取最佳类型（基于预估留存率）
 */
export function getBestGenre(): string {
  return Object.values(genreTemplates)
    .sort((a, b) => b.estimatedRetention - a.estimatedRetention)[0].id;
}

/**
 * 根据主题推荐类型
 */
export function recommendGenre(themes: string[]): string {
  const scores: Record<string, number> = {};
  
  for (const [genreId, template] of Object.entries(genreTemplates)) {
    scores[genreId] = 0;
    
    for (const theme of themes) {
      if (template.popularThemes.includes(theme)) {
        scores[genreId] += 10;
      }
      if (template.structure.setup.includes(theme)) scores[genreId] += 5;
      if (template.structure.conflict.includes(theme)) scores[genreId] += 5;
    }
  }
  
  const bestGenre = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])[0];
  
  return bestGenre?.[0] || 'urban-power';
}

/**
 * 获取类型提示
 */
export function getGenreTips(genreId: string): string[] {
  const template = getGenreTemplate(genreId);
  return [
    `开局：${template.structure.setup}`,
    `冲突：${template.structure.conflict}`,
    `上升：${template.structure.rising}`,
    `高潮：${template.structure.climax}`,
    `结局：${template.structure.resolution}`,
  ];
}
