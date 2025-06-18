import { ALL_ACHIEVEMENTS } from './achievementConfig.js';

export class AchievementChecker {
  constructor() {
    this.resetStats();
  }

  resetStats() {
    // 重置统计数据
    this.stats = {
      // 基础统计
      totalQuestions: 0,
      correctAnswers: 0,
      totalTime: 0,
      maxStreak: 0,
      currentStreak: 0,
      averageTime: 0,
      averageGuesses: 0,
      accuracy: 0,

      // 种族统计 - 猜对的
      correctRaceCount: {},
      // 种族统计 - 猜测的（无论对错）
      guessRaceCount: {},
      
      // 阿戈尔特殊统计
      correctAegiansCount: 0,
      guessAegiansCount: 0,
      
      // 单局种族多样性
      maxRaceDiversityInSingleGame: 0,
      
      // 速度相关
      hasSpeedGuessing: false,
      
      // 当前题目的猜测时间记录
      currentQuestionGuesses: [],
      currentQuestionStartTime: null
    };
  }

  // 开始新题目
  startQuestion() {
    this.stats.currentQuestionGuesses = [];
    this.stats.currentQuestionStartTime = Date.now();
  }

  // 处理猜测
  processGuess(guessedOperator, isCorrect, targetOperator) {
    // 记录猜测时间
    const guessTime = Date.now();
    this.stats.currentQuestionGuesses.push({
      operator: guessedOperator,
      time: guessTime,
      isCorrect
    });

    // 统计种族猜测（无论对错）
    const guessedRace = guessedOperator.种族;
    this.stats.guessRaceCount[guessedRace] = (this.stats.guessRaceCount[guessedRace] || 0) + 1;

    // 阿戈尔统计（猜测）
    if (this.isAegir(guessedOperator)) {
      this.stats.guessAegiansCount++;
    }

    // 如果猜对了
    if (isCorrect) {
      // 统计种族猜对
      const targetRace = targetOperator.种族;
      this.stats.correctRaceCount[targetRace] = (this.stats.correctRaceCount[targetRace] || 0) + 1;
      
      // 阿戈尔统计（猜对）
      if (this.isAegir(targetOperator)) {
        this.stats.correctAegiansCount++;
      }

      // 连胜统计
      this.stats.currentStreak++;
      this.stats.maxStreak = Math.max(this.stats.maxStreak, this.stats.currentStreak);
      this.stats.correctAnswers++;
    } else {
      this.stats.currentStreak = 0;
    }

    // 检查速度猜测成就
    this.checkSpeedGuessing();
  }

  // 完成题目
  completeQuestion(timeUsed, guessCount) {
    this.stats.totalQuestions++;
    this.stats.totalTime += timeUsed;
    
    // 计算平均值
    this.stats.averageTime = this.stats.totalTime / this.stats.totalQuestions;
    this.stats.accuracy = (this.stats.correctAnswers / this.stats.totalQuestions) * 100;
    
    // 计算单局种族多样性
    const racesInThisQuestion = new Set(this.stats.currentQuestionGuesses.map(g => g.operator.种族));
    this.stats.maxRaceDiversityInSingleGame = Math.max(
      this.stats.maxRaceDiversityInSingleGame, 
      racesInThisQuestion.size
    );
  }

  // 完成挑战，计算最终平均猜测次数
  completeChallenge(results) {
    const totalGuesses = results.reduce((sum, result) => sum + result.guesses.length, 0);
    this.stats.averageGuesses = totalGuesses / results.length;
  }

  // 检查是否是阿戈尔
  isAegir(operator) {
    return operator.种族 === '阿戈尔' || operator.国家 === '阿戈尔';
  }

  // 检查速度猜测成就
  checkSpeedGuessing() {
    if (this.stats.currentQuestionGuesses.length >= 3) {
      const firstGuessTime = this.stats.currentQuestionGuesses[0].time;
      const thirdGuessTime = this.stats.currentQuestionGuesses[2].time;
      const timeDiff = (thirdGuessTime - firstGuessTime) / 1000; // 转换为秒
      
      if (timeDiff <= 30) {
        this.stats.hasSpeedGuessing = true;
      }
    }
  }

  // 检查实时成就（每次猜测后检查）
  checkRealTimeAchievements() {
    const earnedAchievements = [];
    
    // 只检查实时成就
    const realTimeAchievements = ALL_ACHIEVEMENTS.filter(achievement => 
      achievement.trigger === 'realtime'
    );
    
    for (const achievement of realTimeAchievements) {
      if (this.evaluateCondition(achievement.condition)) {
        earnedAchievements.push(achievement);
      }
    }
    
    return earnedAchievements;
  }

  // 检查最终成就（挑战结束时检查）
  checkFinalAchievements() {
    const earnedAchievements = [];
    
    // 只检查最终成就
    const finalAchievements = ALL_ACHIEVEMENTS.filter(achievement => 
      achievement.trigger === 'final'
    );
    
    for (const achievement of finalAchievements) {
      if (this.evaluateCondition(achievement.condition)) {
        earnedAchievements.push(achievement);
      }
    }
    
    return earnedAchievements;
  }

  // 检查新获得的成就（兼容性方法，用于结果页面）
  checkNewAchievements() {
    const earnedAchievements = [];
    
    for (const achievement of ALL_ACHIEVEMENTS) {
      if (this.evaluateCondition(achievement.condition)) {
        earnedAchievements.push(achievement);
      }
    }
    
    return earnedAchievements;
  }

  // 评估成就条件
  evaluateCondition(condition) {
    try {
      // 创建一个安全的评估环境
      const context = {
        accuracy: this.stats.accuracy,
        averageTime: this.stats.averageTime,
        averageGuesses: this.stats.averageGuesses,
        totalQuestions: this.stats.totalQuestions,
        maxStreak: this.stats.maxStreak,
        correctRaceCount: this.stats.correctRaceCount,
        guessRaceCount: this.stats.guessRaceCount,
        correctAegiansCount: this.stats.correctAegiansCount,
        guessAegiansCount: this.stats.guessAegiansCount,
        maxRaceDiversityInSingleGame: this.stats.maxRaceDiversityInSingleGame,
        hasSpeedGuessing: this.stats.hasSpeedGuessing,
        Math: Math
      };

      // 使用Function构造器创建一个安全的评估函数
      const func = new Function(...Object.keys(context), `return ${condition}`);
      return func(...Object.values(context));
    } catch (error) {
      console.warn('成就条件评估失败:', condition, error);
      return false;
    }
  }

  // 获取所有已获得的成就
  getAllEarnedAchievements() {
    return this.checkNewAchievements();
  }

  // 获取统计数据
  getStats() {
    return { ...this.stats };
  }
}

// 全局成就检查器实例
export const achievementChecker = new AchievementChecker();