// 成就事件发射器
export class AchievementEmitter {
  constructor() {
    this.earnedAchievements = new Set(); // 记录已获得的成就，避免重复通知
  }

  // 发射成就获得事件
  emitAchievement(achievement) {
    // 检查是否已经获得过这个成就
    if (this.earnedAchievements.has(achievement.id)) {
      return false;
    }

    // 标记为已获得
    this.earnedAchievements.add(achievement.id);

    // 发射自定义事件
    const event = new CustomEvent('achievement-earned', {
      detail: achievement
    });
    window.dispatchEvent(event);

    console.log('🏆 成就达成:', achievement.name);
    return true;
  }

  // 批量发射成就
  emitAchievements(achievements) {
    const newAchievements = [];
    for (const achievement of achievements) {
      if (this.emitAchievement(achievement)) {
        newAchievements.push(achievement);
      }
    }
    return newAchievements;
  }

  // 重置已获得的成就（新游戏开始时）
  reset() {
    this.earnedAchievements.clear();
  }

  // 检查是否已获得某个成就
  hasAchievement(achievementId) {
    return this.earnedAchievements.has(achievementId);
  }

  // 获取所有已获得的成就ID
  getEarnedAchievementIds() {
    return Array.from(this.earnedAchievements);
  }
}

// 全局成就发射器实例
export const achievementEmitter = new AchievementEmitter();