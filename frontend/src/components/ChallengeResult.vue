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
            <div class="target-operator">
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
            
            <!-- 猜测过程展示 -->
            <div v-if="result.guesses.length > 0" class="guess-process">
              <div class="process-title">猜测过程</div>
              <div class="guess-timeline">
                <div 
                  v-for="(guess, gIndex) in result.guesses.slice(0, 3)" 
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
                  <span class="step-number">{{ gIndex + 1 }}</span>
                </div>
                <div v-if="result.guesses.length > 3" class="more-guesses">
                  +{{ result.guesses.length - 3 }} 次
                </div>
              </div>
            </div>
            
            <div class="question-stats">
              <div class="stat-simple">
                <span>用时: {{ formatTime(result.timeUsed) }}</span>
                <span>猜测: {{ result.guesses.length }} 次</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 分享功能 -->
    <div class="share-section">
      <h3 class="share-title">分享挑战</h3>
      <p class="share-desc">让朋友们也来挑战相同的设置吧！复制分享码给朋友，或扫描二维码即可开始挑战。</p>
      
      <div class="share-options">
        <div class="share-option">
          <label class="share-label">
            <input 
              type="checkbox" 
              v-model="shareWithQuestions"
              class="share-checkbox"
            />
            包含相同题目
          </label>
          <span class="share-help">勾选后朋友将挑战完全相同的干员</span>
        </div>
      </div>

      <div class="share-actions">
        <button class="share-btn generate-btn" @click="generateShareCode">
          <span class="btn-icon">🔗</span>
          生成分享码
        </button>
        
        <button 
          v-if="shareCode" 
          class="share-btn copy-btn" 
          @click="copyShareCode"
          :disabled="copyButtonText !== '复制分享码'"
        >
          <span class="btn-icon">📋</span>
          {{ copyButtonText }}
        </button>
        
        <button 
          v-if="shareCode" 
          class="share-btn qr-btn" 
          @click="showQRCode = !showQRCode"
        >
          <span class="btn-icon">📱</span>
          {{ showQRCode ? '隐藏' : '显示' }}二维码
        </button>
      </div>

      <!-- 分享码显示 -->
      <div v-if="shareCode" class="share-code-display">
        <div class="code-container">
          <code class="share-code">{{ shareCode }}</code>
        </div>
        <p class="code-help">
          <strong>使用方法：</strong><br>
          1. 复制上方分享码发给朋友<br>
          2. 朋友在挑战模式中输入分享码即可开始相同设置的挑战<br>
          3. 或直接扫描下方二维码
        </p>
      </div>

      <!-- 二维码显示 -->
      <div v-if="showQRCode && qrCodeUrl" class="qr-code-container">
        <div class="qr-code" ref="qrCodeRef"></div>
        <p class="qr-help">扫描二维码直接开始挑战</p>
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
import { ref, computed, watch, nextTick } from 'vue';
import { calculateFinalStats, generateShareCode as createShareCode, generateQRCodeData } from '../logic/challengeService';
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
  emits: ['restart', 'share', 'back'],
  setup(props, { emit }) {
    const shareWithQuestions = ref(false);
    const shareCode = ref('');
    const showQRCode = ref(false);
    const qrCodeUrl = ref('');
    const copyButtonText = ref('复制分享码');
    const qrCodeRef = ref(null);
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

    // 生成分享码
    const generateShareCode = () => {
      const challengeData = {
        settings: props.settings,
        results: shareWithQuestions.value ? props.results : [],
        includeTargets: shareWithQuestions.value
      };
      
      shareCode.value = createShareCode(challengeData);
      
      // 生成二维码URL
      qrCodeUrl.value = generateQRCodeData(shareCode.value);
      
      // 生成二维码图片
      nextTick(() => {
        if (showQRCode.value) {
          generateQRCodeImage();
        }
      });
    };

    // 复制分享码
    const copyShareCode = async () => {
      try {
        await navigator.clipboard.writeText(shareCode.value);
        copyButtonText.value = '已复制！';
        setTimeout(() => {
          copyButtonText.value = '复制分享码';
        }, 2000);
      } catch (error) {
        console.error('复制失败:', error);
        // 降级到选择文本的方式
        fallbackCopyToClipboard(shareCode.value);
      }
    };

    // 降级复制方法
    const fallbackCopyToClipboard = (text) => {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        copyButtonText.value = '已复制！';
        setTimeout(() => {
          copyButtonText.value = '复制分享码';
        }, 2000);
      } catch (error) {
        copyButtonText.value = '复制失败';
        setTimeout(() => {
          copyButtonText.value = '复制分享码';
        }, 2000);
      }
      document.body.removeChild(textArea);
    };

    // 生成二维码图片 (简单实现，实际项目中可以使用qrcode.js库)
    const generateQRCodeImage = async () => {
      if (!qrCodeRef.value || !qrCodeUrl.value) return;
      
      // 这里应该使用专门的二维码库，比如qrcode.js
      // 为了简化，我们用一个简单的在线API
      try {
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeUrl.value)}`;
        
        const img = document.createElement('img');
        img.src = qrApiUrl;
        img.alt = '挑战二维码';
        img.style.width = '200px';
        img.style.height = '200px';
        img.style.border = '1px solid var(--color-border)';
        img.style.borderRadius = '8px';
        
        qrCodeRef.value.innerHTML = '';
        qrCodeRef.value.appendChild(img);
      } catch (error) {
        console.error('生成二维码失败:', error);
        qrCodeRef.value.innerHTML = '<p>二维码生成失败</p>';
      }
    };

    // 监听二维码显示状态
    const handleQRToggle = () => {
      if (showQRCode.value && qrCodeUrl.value) {
        nextTick(() => {
          generateQRCodeImage();
        });
      }
    };

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

    // 监听showQRCode变化
    watch(() => showQRCode.value, handleQRToggle);

    return {
      finalStats,
      shareWithQuestions,
      shareCode,
      showQRCode,
      qrCodeUrl,
      copyButtonText,
      qrCodeRef,
      achievements,
      generateShareCode,
      copyShareCode,
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
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.question-card {
  background: linear-gradient(135deg, 
    rgba(255,255,255,0.08), 
    rgba(255,255,255,0.03)
  );
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 1rem;
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
  margin-bottom: 0.75rem;
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

.target-operator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.operator-avatar {
  width: 48px;
  height: 48px;
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
  font-size: 1rem;
}

.operator-rarity {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  opacity: 0.8;
}

/* 猜测过程展示 */
.guess-process {
  margin-bottom: 1rem;
}

.process-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.guess-timeline {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.guess-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  transition: all 0.3s ease;
}

.guess-step.correct {
  background: rgba(40, 167, 69, 0.15);
  border-color: #28a745;
}

.guess-step.final {
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.guess-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.guess-name {
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--color-text);
  text-align: center;
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.step-number {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 16px;
  height: 16px;
  background: var(--color-primary);
  color: white;
  border-radius: 50%;
  font-size: 0.6rem;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.more-guesses {
  padding: 0.25rem 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px dashed rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  font-size: 0.7rem;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.question-stats {
  margin-top: 0.5rem;
}

.stat-simple {
  display: flex;
  gap: 1rem;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

/* 分享功能 */
.share-section {
  background: linear-gradient(135deg, 
    var(--color-card-bg), 
    rgba(245, 158, 11, 0.05)
  );
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  position: relative;
}

.share-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, 
    rgba(245, 158, 11, 0.02), 
    rgba(249, 115, 22, 0.01)
  );
  border-radius: 12px;
  pointer-events: none;
}

.share-title {
  margin: 0 0 0.5rem 0;
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--color-text);
}

.share-desc {
  margin: 0 0 1rem 0;
  color: var(--color-text-secondary);
}

.share-options {
  margin-bottom: 1rem;
}

.share-option {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.share-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  cursor: pointer;
}

.share-checkbox {
  width: 16px;
  height: 16px;
}

.share-help {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  margin-left: 1.5rem;
}

.share-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.share-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s ease;
}

.generate-btn {
  background: var(--color-primary);
  color: white;
}

.generate-btn:hover {
  background: var(--color-primary-hover);
}

.copy-btn, .qr-btn {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

.copy-btn:hover, .qr-btn:hover {
  border-color: var(--color-primary);
}

.copy-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.share-code-display {
  margin-bottom: 1rem;
}

.code-container {
  background: rgba(0, 0, 0, 0.1);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.75rem;
  margin-bottom: 0.5rem;
}

.share-code {
  font-family: monospace;
  font-size: 0.9rem;
  word-break: break-all;
  color: var(--color-text);
}

.code-help, .qr-help {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  margin: 0;
  text-align: center;
}

.qr-code-container {
  text-align: center;
  padding: 1rem;
}

.qr-code {
  margin-bottom: 0.5rem;
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
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  .question-card {
    padding: 0.75rem;
  }
  
  .target-operator {
    padding: 0.5rem;
    margin-bottom: 0.75rem;
  }
  
  .operator-avatar {
    width: 40px;
    height: 40px;
  }
  
  .guess-timeline {
    gap: 0.25rem;
  }
  
  .guess-step {
    padding: 0.25rem;
  }
  
  .guess-avatar {
    width: 24px;
    height: 24px;
  }
  
  .guess-name {
    font-size: 0.6rem;
    max-width: 50px;
  }
  
  .step-number {
    width: 14px;
    height: 14px;
    font-size: 0.55rem;
    top: -5px;
    right: -5px;
  }
  
  .stat-simple {
    gap: 0.5rem;
    font-size: 0.7rem;
  }
  
  .share-actions {
    flex-direction: column;
  }
  
  .result-actions {
    flex-direction: column;
  }
}
</style>