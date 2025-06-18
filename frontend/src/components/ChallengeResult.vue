<template>
  <div class="challenge-result">
    <!-- 结果标题 -->
    <div class="result-header">
      <h2 class="result-title">🎉 挑战完成！</h2>
      <p class="result-subtitle">成功完成 {{ finalStats.correctAnswers }}/{{ finalStats.totalQuestions }} 题</p>
    </div>

    <!-- 成绩统计 -->
    <div class="stats-summary">
      <div class="summary-item">
        <span class="summary-label">准确率</span>
        <span class="summary-value">{{ Math.round(finalStats.accuracy) }}%</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">总用时</span>
        <span class="summary-value">{{ formatTime(finalStats.totalTime) }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">平均用时</span>
        <span class="summary-value">{{ formatTime(finalStats.averageTime) }}</span>
      </div>
    </div>

    <!-- 成就系统 -->
    <div v-if="achievements.length > 0" class="achievements-section">
      <h3 class="achievements-title">🏅 获得成就</h3>
      <div class="achievements-grid">
        <div 
          v-for="achievement in achievements" 
          :key="achievement.id"
          class="achievement-card"
        >
          <div class="achievement-icon">{{ achievement.icon }}</div>
          <div class="achievement-info">
            <div class="achievement-name">{{ achievement.name }}</div>
            <div class="achievement-desc">{{ achievement.description }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 题目详情 -->
    <div class="questions-detail">
      <h3 class="detail-title">题目详情</h3>
      <div class="questions-grid">
        <div 
          v-for="(result, index) in results" 
          :key="index"
          class="question-card"
          :class="{ correct: result.isCorrect, incorrect: !result.isCorrect }"
        >
          <div class="question-header">
            <span class="question-number">第 {{ index + 1 }} 题</span>
            <span class="question-status">
              {{ result.isCorrect ? '✓' : '✗' }}
            </span>
          </div>
          
          <div class="question-info">
            <div class="question-main">
              <div class="target-section">
                <img 
                  :src="getOperatorAvatar(result.targetOperator)" 
                  :alt="result.targetOperator.干员"
                  class="operator-avatar"
                />
                <div class="operator-details">
                  <span class="operator-name">{{ result.targetOperator.干员 }}</span>
                  <span class="operator-rarity">{{ result.targetOperator.星级 }}★ {{ result.targetOperator.职业 }}</span>
                </div>
              </div>
              
              <div class="question-stats">
                <span class="stat-badge time-badge">{{ formatTime(result.timeUsed) }}</span>
                <span class="stat-badge guess-badge">{{ result.guesses.length }} 次</span>
              </div>
            </div>
            
            <!-- 猜测过程展示 -->
            <div v-if="result.guesses.length > 1" class="guess-process">
              <div class="guess-timeline">
                <div 
                  v-for="(guess, gIndex) in result.guesses.slice(0, 4)" 
                  :key="gIndex"
                  class="guess-step"
                  :class="{ 
                    correct: guess.干员 === result.targetOperator.干员,
                    final: gIndex === result.guesses.length - 1 || guess.干员 === result.targetOperator.干员
                  }"
                >
                  <img 
                    :src="getOperatorAvatar(guess)" 
                    :alt="guess.干员"
                    class="guess-avatar"
                  />
                  <span class="guess-name">{{ guess.干员 }}</span>
                </div>
                <div v-if="result.guesses.length > 4" class="more-guesses">
                  +{{ result.guesses.length - 4 }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>


    <!-- 操作按钮 -->
    <div class="result-actions">
      <button class="action-btn secondary-btn" @click="$emit('back')">
        返回主页
      </button>
      <button class="action-btn primary-btn" @click="$emit('restart')">
        再来一次
      </button>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue';
import { calculateFinalStats } from '../logic/challengeService';
import { achievementChecker } from '../logic/achievementChecker';
import { getOperatorAvatarFile, getImagePath } from '../utils/imageUtils';

export default {
  name: 'ChallengeResult',
  props: {
    results: {
      type: Array,
      required: true
    },
    settings: {
      type: Object,
      required: true
    }
  },
  emits: ['restart', 'back'],
  setup(props, { emit }) {
    const achievements = ref([]);

    // 计算最终统计
    const finalStats = computed(() => {
      return calculateFinalStats(props.results, props.settings);
    });

    // 获取本局游戏获得的所有成就
    const getSessionAchievements = () => {
      achievements.value = achievementChecker.getAllEarnedAchievements();
    };

    // 初始化时获取成就
    getSessionAchievements();


    // 获取干员头像
    const getOperatorAvatar = (operator) => {
      const file = getOperatorAvatarFile(operator.干员, operator.稀有度);
      return getImagePath(file);
    };

    // 格式化时间
    const formatTime = (seconds) => {
      if (seconds === 0 || seconds === Infinity || seconds >= 300) {
        return '无限制';
      }
      const mins = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      if (mins > 0) {
        return `${mins}:${secs.toString().padStart(2, '0')}`;
      }
      return `${secs}秒`;
    };

    return {
      finalStats,
      achievements,
      getOperatorAvatar,
      formatTime
    };
  }
};
</script>

<style scoped>
.challenge-result {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

/* 结果标题 */
.result-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.result-title {
  margin: 0 0 0.5rem 0;
  font-size: 1.8rem;
  font-weight: 600;
  color: var(--color-text);
}

.result-subtitle {
  margin: 0;
  font-size: 1rem;
  color: var(--color-text-secondary);
}

/* 成绩摘要 */
.stats-summary {
  display: flex;
  justify-content: space-around;
  background: linear-gradient(135deg, 
    rgba(255,255,255,0.08), 
    rgba(255,255,255,0.03)
  );
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.summary-label {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
}

.summary-value {
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--color-text);
}

/* 成就系统 */
.achievements-section {
  margin-bottom: 2rem;
}

.achievements-title {
  margin: 0 0 1rem 0;
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--color-text);
}

.achievements-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.achievement-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: linear-gradient(135deg, 
    rgba(245, 158, 11, 0.1), 
    rgba(249, 115, 22, 0.05)
  );
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 8px;
  padding: 1rem;
  animation: achievementPop 0.5s ease-out;
}

@keyframes achievementPop {
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.achievement-icon {
  font-size: 2rem;
  flex-shrink: 0;
}

.achievement-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.achievement-name {
  font-weight: 600;
  color: var(--color-text);
  font-size: 0.95rem;
}

.achievement-desc {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

/* 题目详情 */
.questions-detail {
  margin-bottom: 2rem;
}

.detail-title {
  margin: 0 0 1rem 0;
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--color-text);
}

.questions-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}

.question-card {
  background: linear-gradient(135deg, 
    rgba(255,255,255,0.06), 
    rgba(255,255,255,0.02)
  );
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.75rem;
  transition: all 0.3s ease;
}

.question-card.correct {
  border-color: #28a745;
  background: linear-gradient(135deg, 
    rgba(40, 167, 69, 0.15), 
    rgba(40, 167, 69, 0.05)
  );
}

.question-card.incorrect {
  border-color: #dc3545;
  background: linear-gradient(135deg, 
    rgba(220, 53, 69, 0.15), 
    rgba(220, 53, 69, 0.05)
  );
}

.question-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.question-number {
  font-weight: 600;
  color: var(--color-text);
}

.question-status {
  font-size: 1.2rem;
  font-weight: bold;
}

.question-card.correct .question-status {
  color: #28a745;
}

.question-card.incorrect .question-status {
  color: #dc3545;
}

.question-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.target-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.operator-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid rgba(255, 255, 255, 0.2);
}

.operator-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.operator-name {
  font-weight: 600;
  color: var(--color-text);
  font-size: 0.95rem;
}

.operator-rarity {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  opacity: 0.8;
}

.question-stats {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.stat-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: var(--color-text-secondary);
}

.time-badge {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.3);
  color: #22c55e;
}

.guess-badge {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.3);
  color: #3b82f6;
}

/* 猜测过程展示 */
.guess-process {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 0.5rem;
}

.guess-timeline {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.guess-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
  min-width: 50px;
}

.guess-step.correct {
  background: rgba(40, 167, 69, 0.15);
  border-color: #28a745;
}

.guess-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.guess-name {
  font-size: 0.65rem;
  font-weight: 500;
  color: var(--color-text);
  text-align: center;
  max-width: 48px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.more-guesses {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px dashed rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  font-size: 0.65rem;
  color: var(--color-text-secondary);
  font-weight: 500;
  min-width: 40px;
}


/* 操作按钮 */
.result-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
}

.action-btn {
  padding: 1rem 2rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.primary-btn {
  background: var(--color-primary);
  color: white;
}

.primary-btn:hover {
  background: var(--color-primary-hover);
  transform: translateY(-2px);
}

.secondary-btn {
  background: transparent;
  border: 2px solid var(--color-border);
  color: var(--color-text);
}

.secondary-btn:hover {
  border-color: var(--color-primary);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .challenge-result {
    padding: 1rem;
  }
  
  .result-title {
    font-size: 1.5rem;
  }
  
  .stats-summary {
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }
  
  .summary-item {
    flex-direction: row;
    justify-content: space-between;
  }
  
  .summary-value {
    font-size: 1.1rem;
  }
  
  .achievements-grid {
    grid-template-columns: 1fr;
  }
  
  .achievement-card {
    padding: 0.75rem;
    gap: 0.75rem;
  }
  
  .questions-grid {
    gap: 0.5rem;
  }
  
  .question-card {
    padding: 0.5rem;
  }
  
  .question-main {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .target-section {
    gap: 0.5rem;
  }
  
  .operator-avatar {
    width: 32px;
    height: 32px;
  }
  
  .operator-name {
    font-size: 0.85rem;
  }
  
  .operator-rarity {
    font-size: 0.7rem;
  }
  
  .question-stats {
    gap: 0.25rem;
  }
  
  .stat-badge {
    padding: 0.2rem 0.4rem;
    font-size: 0.7rem;
  }
  
  .guess-timeline {
    gap: 0.25rem;
    flex-wrap: wrap;
  }
  
  .guess-step {
    padding: 0.2rem;
    min-width: 40px;
  }
  
  .guess-avatar {
    width: 20px;
    height: 20px;
  }
  
  .guess-name {
    font-size: 0.6rem;
    max-width: 38px;
  }
  
  .more-guesses {
    padding: 0.2rem 0.3rem;
    font-size: 0.6rem;
    min-width: 32px;
  }
  
  
  .result-actions {
    flex-direction: column;
  }
}
</style>