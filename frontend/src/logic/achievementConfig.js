// 成就配置
export const ACHIEVEMENTS = {
  // 种族相关成就
  race: [
    {
      id: 'cat_lover',
      name: '小猫爱好者',
      description: '猜对三个种族为菲林的干员',
      icon: '🐱',
      condition: 'correctRaceCount.菲林 >= 3',
      trigger: 'realtime' // 实时检查
    },
    {
      id: 'cat_wanter',
      name: '小猫渴望者',
      description: '猜测五次种族为菲林的干员（无论是否正确）',
      icon: '😸',
      condition: 'guessRaceCount.菲林 >= 5',
      trigger: 'realtime'
    },
    {
      id: 'dog_lover',
      name: '小狗爱好者',
      description: '猜对三个种族为佩洛的干员',
      icon: '🐶',
      condition: 'correctRaceCount.佩洛 >= 3',
      trigger: 'realtime'
    },
    {
      id: 'dog_wanter',
      name: '小狗渴望者',
      description: '猜测五次种族为佩洛的干员（无论是否正确）',
      icon: '🐕',
      condition: 'guessRaceCount.佩洛 >= 5',
      trigger: 'realtime'
    },
    {
      id: 'bird_watcher',
      name: '观鸟员',
      description: '猜对三个种族为黎博利的干员',
      icon: '🦅',
      condition: 'correctRaceCount.黎博利 >= 3',
      trigger: 'realtime'
    },
    {
      id: 'bird_trainee',
      name: '观鸟实习生',
      description: '猜测五个种族为黎博利的干员（无论是否正确）',
      icon: '🐦',
      condition: 'guessRaceCount.黎博利 >= 5',
      trigger: 'realtime'
    },
    {
      id: 'from_sea',
      name: '自大海来',
      description: '猜对三个来自阿戈尔/种族为阿戈尔的干员',
      icon: '🌊',
      condition: 'correctAegiansCount >= 3',
      trigger: 'realtime'
    },
    {
      id: 'to_ocean',
      name: '奔赴海洋',
      description: '猜测五个来自阿戈尔/种族为阿戈尔的干员（无论是否正确）',
      icon: '🌊',
      condition: 'guessAegiansCount >= 5',
      trigger: 'realtime'
    },
    {
      id: 'noahs_ark',
      name: '诺亚方舟',
      description: '在一次猜测中分别猜测了四种以上的种族',
      icon: '🛶',
      condition: 'maxRaceDiversityInSingleGame >= 4',
      trigger: 'realtime'
    }
  ],

  // 速度相关成就
  speed: [
    {
      id: 'speed_hand',
      name: '极速之手',
      description: '在30秒内猜测3次',
      icon: '⚡',
      condition: 'hasSpeedGuessing',
      trigger: 'realtime'
    }
  ],

  // 基础表现成就 (保留原有)
  performance: [
    {
      id: 'perfect',
      name: '完美无缺',
      description: '全部答对，完美表现！',
      icon: '💎',
      condition: 'accuracy === 100',
      trigger: 'final' // 挑战结束时检查
    },
    {
      id: 'speedster',
      name: '闪电快手',
      description: '至少答对一题，平均用时不超过15秒',
      icon: '⚡',
      condition: 'correctAnswers > 0 && averageTime <= 15',
      trigger: 'final'
    },
    {
      id: 'efficient',
      name: '一击制胜',
      description: '全部答对，平均猜测次数不超过2次',
      icon: '🎯',
      condition: 'totalQuestions > 0 && correctAnswers === totalQuestions && averageGuesses <= 2',
      trigger: 'final'
    },
    {
      id: 'endurance',
      name: '持久战士',
      description: '完成10题或以上的挑战',
      icon: '🔥',
      condition: 'totalQuestions >= 10',
      trigger: 'final'
    },
    {
      id: 'streak',
      name: '连胜达人',
      description: '连续答对5题或以上',
      icon: '🌟',
      condition: 'maxStreak >= 5',
      trigger: 'final'
    }
  ]
};

// 扁平化所有成就，便于查找
export const ALL_ACHIEVEMENTS = Object.values(ACHIEVEMENTS).flat();

// 根据ID查找成就
export function getAchievementById(id) {
  return ALL_ACHIEVEMENTS.find(achievement => achievement.id === id);
}

// 获取成就分类
export function getAchievementCategories() {
  return Object.keys(ACHIEVEMENTS);
}