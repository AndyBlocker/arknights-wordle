// config/constants.js - 游戏配置常量

export const GAME_CONFIG = {
  // 游戏基本设置
  DEFAULT_MAX_GUESSES: 6,
  MIN_GUESSES: 3,
  MAX_GUESSES_NORMAL: 12,
  MAX_GUESSES_PUZZLE: 15,
  
  // 搜索设置
  SEARCH_DEBOUNCE_DELAY: 150,
  MAX_SEARCH_RESULTS: 8,
  MAX_OPERATOR_NAME_LENGTH: 20,
  MAX_SEARCH_KEYWORD_LENGTH: 30,

  // 缓存设置
  MAX_PINYIN_CACHE_SIZE: 1000,
  MAX_IMAGE_CACHE_SIZE: 20,
  MAX_OPERATOR_ART_CACHE_SIZE: 100,

  // 性能设置
  IMAGE_LOAD_TIMEOUT: 10000, // 10秒
  INTEGRAL_IMAGE_MAX_SIZE: 800,

  // 主题设置
  THEME_TRANSITION_DURATION: '0.3s',
  
  // Cookie设置
  COOKIE_EXPIRES_DAYS: 365,

  // 错误提示设置
  TOAST_DURATION: 5000,
  
  // 拼音搜索设置
  PINYIN_OPTIONS: {
    toneType: 'none',
    type: 'string'
  },
  
  PINYIN_FIRST_LETTER_OPTIONS: {
    pattern: 'first',
    toneType: 'none', 
    type: 'string'
  }
};

export const PUZZLE_CONFIG = {
  // 谜题基本设置
  DEFAULT_GRID_SIZE: { rows: 4, cols: 4 },
  EASY_GRID_SIZE: { rows: 2, cols: 2 },
  DEFAULT_REFINEMENT_COUNT: 2,
  DEFAULT_REFINEMENT_FACTOR: { rows: 2, cols: 2 },
  
  // 提示设置
  HINT_INTERVAL: 3, // 每3次错误猜测显示一个提示
  
  // 图像处理设置
  DEFAULT_MAX_WIDTH: 600,
  DEFAULT_MAX_HEIGHT: 600,
  MIN_OPACITY_RATIO: 0.15,
  MIN_COVERAGE: 0.01
};

export const UI_CONFIG = {
  // 响应式断点
  MOBILE_BREAKPOINT: 768,
  TABLET_BREAKPOINT: 1024,
  DESKTOP_BREAKPOINT: 1400,
  
  // 动画设置
  ANIMATION_DURATION: {
    FAST: 200,
    NORMAL: 300,
    SLOW: 500
  },
  
  // Z-index层级
  Z_INDEX: {
    DROPDOWN: 10,
    MODAL: 100,
    TOAST: 9999
  }
};

export const TAG_GROUPS = [
  {
    id: 'hard',
    name: '兔头',
    tags: ['星级', '满级攻击', '满级生命', '满级防御', '满级法术抗性', '攻击间隔', '上线年份', '标签']
  },
  {
    id: 'easy',
    name: '大头',
    tags: ['性别', '星级', '职业', '国家', '种族', '源石技艺适应性', '身高', '感染状态', '出生日期', '标签']
  },
  {
    id: 'puzzle',
    name: '小头...?',
    description: '通过像素化立绘逐步细化来猜干员',
    tags: []
  }
];

export const NUMERIC_TAGS = [
  '星级',
  '满级攻击',
  '满级生命', 
  '满级防御',
  '满级法术抗性',
  '部署费用',
  '阻挡数',
  '攻击间隔',
  '身高',
  '上线年份'
];

export const RARITY_COLORS = {
  "1": "#bfbfbf",
  "2": "#bfbfbf", 
  "3": "#00b0ff",
  "4": "#d6c44c",
  "5": "#ffb800",
  "6": "#ff8000"
};

export const ERROR_MESSAGES = {
  NETWORK_ERROR: '网络连接失败，请检查网络设置',
  SERVER_ERROR: '服务器暂时不可用，请稍后重试',
  DATA_LOAD_ERROR: '数据加载失败',
  OPERATOR_NOT_FOUND: '未找到指定干员',
  INVALID_INPUT: '输入内容无效',
  GAME_SESSION_ERROR: '游戏会话错误',
  IMAGE_LOAD_ERROR: '图片加载失败'
};