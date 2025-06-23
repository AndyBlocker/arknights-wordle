<template>
  <div class="challenge-board">
    <!-- 挑战设置阶段 -->
    <div v-if="challengePhase === 'setup'" class="challenge-setup">
      <div class="setup-header">
        <span class="setup-icon">⚡</span>
        <h2 class="setup-title">挑战模式设置</h2>
      </div>
      
      <div class="setup-content">
        <!-- 游戏模式选择 -->
        <div class="setup-section">
          <h3 class="section-title">选择游戏模式</h3>
          <div class="mode-grid">
            <div 
              v-for="mode in availableModes" 
              :key="mode.id"
              class="mode-card"
              :class="{ active: challengeSettings.gameMode === mode.id }"
              @click="challengeSettings.gameMode = mode.id"
            >
              <div class="mode-name">{{ mode.name }}</div>
              <div class="mode-desc">{{ mode.description }}</div>
            </div>
          </div>
        </div>

        <!-- 挑战参数设置 -->
        <div class="setup-section">
          <h3 class="section-title">挑战参数</h3>
          <div class="param-grid">
            <div class="param-item">
              <label class="param-label">题目数量</label>
              <div class="param-control">
                <input 
                  type="range" 
                  min="3" 
                  max="20" 
                  v-model.number="challengeSettings.questionCount"
                  class="modern-range"
                />
                <span class="param-value">{{ challengeSettings.questionCount }} 题</span>
              </div>
            </div>
            
            <div class="param-item">
              <label class="param-label">单题时间限制</label>
              <div class="param-control">
                <input 
                  type="range" 
                  min="30" 
                  max="300" 
                  step="15"
                  v-model.number="challengeSettings.timePerQuestion"
                  class="modern-range"
                />
                <span class="param-value">
                  {{ challengeSettings.timePerQuestion === 300 ? '无限制' : challengeSettings.timePerQuestion + ' 秒' }}
                </span>
              </div>
            </div>
            
            <div class="param-item">
              <label class="param-label">最大猜测次数</label>
              <div class="param-control">
                <input 
                  type="range" 
                  min="3" 
                  max="8" 
                  v-model.number="challengeSettings.maxGuesses"
                  class="modern-range"
                />
                <span class="param-value">{{ challengeSettings.maxGuesses }} 次</span>
              </div>
            </div>
            
            <div class="param-item">
              <label class="param-label">难度设置</label>
              <div class="toggle-group">
                <button 
                  class="toggle-option" 
                  :class="{ active: challengeSettings.onlySixStar }"
                  @click="challengeSettings.onlySixStar = !challengeSettings.onlySixStar"
                >
                  只猜六星
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 模式特有设置 -->
        <div v-if="challengeSettings.gameMode !== 'easy'" class="setup-section">
          <h3 class="section-title">{{ getModeDisplayName(challengeSettings.gameMode) }} 模式设置</h3>
          <div class="param-grid">
            <!-- 兔头模式特有设置 -->
            <template v-if="challengeSettings.gameMode === 'hard'">
              <div class="param-item">
                <label class="param-label">潜能设置</label>
                <div class="toggle-group">
                  <button 
                    class="toggle-option" 
                    :class="{ active: challengeSettings.potentialMode === '0潜' }"
                    @click="challengeSettings.potentialMode = '0潜'"
                  >
                    0潜
                  </button>
                  <button 
                    class="toggle-option" 
                    :class="{ active: challengeSettings.potentialMode === '满潜' }"
                    @click="challengeSettings.potentialMode = '满潜'"
                  >
                    满潜
                  </button>
                </div>
              </div>
              
              <div class="param-item">
                <label class="param-label">信赖设置</label>
                <div class="toggle-group">
                  <button 
                    class="toggle-option" 
                    :class="{ active: challengeSettings.trustMode === '0信赖' }"
                    @click="challengeSettings.trustMode = '0信赖'"
                  >
                    0信赖
                  </button>
                  <button 
                    class="toggle-option" 
                    :class="{ active: challengeSettings.trustMode === '满信赖' }"
                    @click="challengeSettings.trustMode = '满信赖'"
                  >
                    满信赖
                  </button>
                </div>
              </div>
            </template>

            <!-- 小头模式特有设置 -->
            <template v-if="challengeSettings.gameMode === 'puzzle'">
              <div class="param-item">
                <label class="param-label">提示间隔</label>
                <div class="param-control">
                  <input 
                    type="range" 
                    min="1" 
                    max="5" 
                    v-model.number="challengeSettings.puzzleHintInterval"
                    class="modern-range"
                  />
                  <span class="param-value">每 {{ challengeSettings.puzzleHintInterval }} 次错误显示提示</span>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="setup-actions">
          <button class="action-btn secondary-btn" @click="$emit('back')">
            返回
          </button>
          <button 
            class="action-btn primary-btn" 
            @click="startChallenge"
            :disabled="!canStartChallenge"
          >
            开始挑战
          </button>
        </div>
      </div>
    </div>

    <!-- 准备阶段 -->
    <div v-else-if="challengePhase === 'preparing'" class="challenge-preparing">
      <div class="preparing-content">
        <div class="preparing-icon">⚡</div>
        <h2 class="preparing-title">准备挑战中...</h2>
        <p class="preparing-desc">正在生成题目和预加载资源</p>
        <div class="progress-container">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: preparingProgress + '%' }"></div>
          </div>
          <span class="progress-text">{{ preparingProgress }}%</span>
        </div>
      </div>
    </div>

    <!-- 游戏进行阶段 -->
    <div v-else-if="challengePhase === 'playing'" class="challenge-playing">
      <!-- 挑战状态栏 -->
      <div class="challenge-status">
        <div class="status-left">
          <span class="question-counter">题目 {{ currentQuestionIndex + 1 }} / {{ challengeQuestions.length }}</span>
          <span class="score-display">得分: {{ challengeScore }}</span>
        </div>
        <div class="status-right">
          <div class="total-timer">
            <span class="timer-icon">🕐</span>
            <span class="timer-text">总用时: {{ formatTotalTime(totalChallengeTime) }}</span>
          </div>
          <div class="timer" :class="{ warning: timeLeft <= 10 }">
            <span class="timer-icon">⏱️</span>
            <span class="timer-text">{{ formatTime(timeLeft) }}</span>
          </div>
        </div>
      </div>

      <!-- 当前题目 -->
      <div class="current-question">
        <!-- 挑战模式下的游戏组件需要特殊处理 -->
        <div v-if="currentQuestion" class="challenge-question-wrapper">
          <challenge-game-wrapper
            :question="currentQuestion"
            :settings="challengeSettings"
            :operators="operators"
            :guesses="currentGuesses"
            :comparisons="currentComparisons"
            :gameOver="gameOver"
            :gameWon="gameWon"
            :preloadedAssets="currentQuestion.puzzleAssets"
            @guess="handleGuess"
            class="question-board"
          />
        </div>
      </div>
    </div>

    <!-- 结果阶段 -->
    <div v-else-if="challengePhase === 'result'" class="challenge-result">
      <challenge-result 
        :results="challengeResults"
        :settings="challengeSettings"
        @restart="restartChallenge"
        @back="$emit('back')"
      />
    </div>
  </div>
</template>

<script>
import { ref, computed, onBeforeUnmount } from 'vue';
import { generateChallengeQuestions, calculateChallengeScore } from '../logic/challengeService';
import { compareOperators } from '../logic/gameLogic';
import { achievementChecker } from '../logic/achievementChecker';
import { achievementEmitter } from '../utils/achievementEmitter';
import ChallengeResult from './ChallengeResult.vue';
import ChallengeGameWrapper from './ChallengeGameWrapper.vue';

export default {
  name: 'ChallengeBoard',
  components: {
    ChallengeResult,
    ChallengeGameWrapper
  },
  props: {
    operators: {
      type: Array,
      required: true
    },
    availableModes: {
      type: Array,
      default: () => [
        { id: 'easy', name: '大头模式', description: '基础属性猜测', icon: '🎯' },
        { id: 'hard', name: '兔头模式', description: '数值属性猜测', icon: '🔥' },
        { id: 'puzzle', name: '小头模式', description: '立绘拼图猜测', icon: '🧩' }
      ]
    }
  },
  emits: ['back'],
  setup(props, { emit }) {
    // 挑战状态
    const challengePhase = ref('setup'); // setup, preparing, playing, result
    const challengeSettings = ref({
      gameMode: 'easy',
      questionCount: 5,
      timePerQuestion: 300, // 默认无限制
      maxGuesses: 6,
      onlySixStar: false,
      // 模式特有设置
      potentialMode: '满潜',
      trustMode: '满信赖',
      puzzleHintInterval: 3
    });

    // 游戏状态
    const challengeQuestions = ref([]);
    const currentQuestionIndex = ref(0);
    const challengeScore = ref(0);
    const challengeResults = ref([]);
    const timeLeft = ref(0);
    const preparingProgress = ref(0);
    const totalChallengeTime = ref(0);
    const challengeStartTime = ref(0);
    let totalTimer = null;
    
    // 当前题目和游戏状态
    const currentQuestion = ref(null);
    const currentGuesses = ref([]);
    const currentComparisons = ref([]);
    const gameOver = ref(false);
    const gameWon = ref(false);
    const questionStartTime = ref(0);
    let gameTimer = null;

    // 计算属性
    const canStartChallenge = computed(() => {
      return challengeSettings.value.gameMode && 
             challengeSettings.value.questionCount > 0 &&
             challengeSettings.value.timePerQuestion > 0;
    });

    // 开始挑战
    const startChallenge = async () => {
      challengePhase.value = 'preparing';
      preparingProgress.value = 0;
      
      try {
        // 生成挑战题目
        const questions = await generateChallengeQuestions(
          props.operators,
          challengeSettings.value,
          (progress) => {
            preparingProgress.value = Math.round(progress * 100);
          }
        );
        
        challengeQuestions.value = questions;
        currentQuestionIndex.value = 0;
        challengeScore.value = 0;
        challengeResults.value = [];
        
        // 开始第一题
        challengePhase.value = 'playing';
        challengeStartTime.value = Date.now();
        totalChallengeTime.value = 0;
        
        // 重置成就系统
        achievementChecker.resetStats();
        achievementEmitter.reset();
        
        // 启动总计时器
        totalTimer = setInterval(() => {
          totalChallengeTime.value = Math.floor((Date.now() - challengeStartTime.value) / 1000);
        }, 1000);
        
        startQuestion();
        
      } catch (error) {
        console.error('准备挑战失败:', error);
        challengePhase.value = 'setup';
      }
    };

    // 开始单题
    const startQuestion = () => {
      if (currentQuestionIndex.value >= challengeQuestions.value.length) {
        finishChallenge();
        return;
      }
      
      currentQuestion.value = challengeQuestions.value[currentQuestionIndex.value];
      currentGuesses.value = [];
      currentComparisons.value = [];
      gameOver.value = false;
      gameWon.value = false;
      questionStartTime.value = Date.now();
      
      // 通知成就系统开始新题目
      achievementChecker.startQuestion();
      
      // 设置时间限制
      if (challengeSettings.value.timePerQuestion >= 300) {
        timeLeft.value = Infinity; // 无限制
      } else {
        timeLeft.value = challengeSettings.value.timePerQuestion;
        // 启动计时器
        gameTimer = setInterval(() => {
          timeLeft.value--;
          if (timeLeft.value <= 0) {
            timeUp();
          }
        }, 1000);
      }
    };

    // 处理猜测
    const handleGuess = (operatorName) => {
      if (gameOver.value || gameWon.value) return;
      
      // 找到猜测的干员 - 增强查找逻辑
      const guessedOp = props.operators.find(op => {
        // 1. 精确匹配
        if (op.干员 === operatorName) return true;
        
        // 2. 清理特殊字符后匹配
        const cleanOpName = op.干员.replace(/[·\u00B7\u2022\u2027]/g, '');
        const cleanInputName = operatorName.replace(/[·\u00B7\u2022\u2027]/g, '');
        if (cleanOpName === cleanInputName) return true;
        
        return false;
      });
      
      if (!guessedOp) {
        console.warn('未找到干员:', operatorName);
        return;
      }
      
      currentGuesses.value.push(guessedOp);
      
      // 检查是否猜对
      const isCorrect = guessedOp.干员 === currentQuestion.value.targetOperator.干员;
      
      // 通知成就系统处理猜测
      achievementChecker.processGuess(
        guessedOp, 
        isCorrect, 
        currentQuestion.value.targetOperator
      );
      
      // 检查实时成就
      const newAchievements = achievementChecker.checkRealTimeAchievements();
      achievementEmitter.emitAchievements(newAchievements);
      
      // 如果不是小头模式，需要生成对比结果
      if (challengeSettings.value.gameMode !== 'puzzle') {
        // 获取选中的标签组
        const tagGroup = getSelectedTagGroup();
        const comparison = compareOperators(
          guessedOp,
          currentQuestion.value.targetOperator,
          tagGroup.tags,
          challengeSettings.value.potentialMode || '满潜',
          challengeSettings.value.trustMode || '满信赖'
        );
        currentComparisons.value.push(comparison);
      }
      
      if (isCorrect) {
        gameWon.value = true;
        questionComplete(true);
      } else if (currentGuesses.value.length >= challengeSettings.value.maxGuesses) {
        gameOver.value = true;
        questionComplete(false);
      }
    };

    // 时间到
    const timeUp = () => {
      if (!gameOver.value && !gameWon.value) {
        gameOver.value = true;
        questionComplete(false);
      }
    };

    // 题目完成
    const questionComplete = (isCorrect) => {
      if (gameTimer) {
        clearInterval(gameTimer);
        gameTimer = null;
      }
      
      // 计算实际用时
      const timeUsed = Math.floor((Date.now() - questionStartTime.value) / 1000);
      
      // 通知成就系统完成题目
      achievementChecker.completeQuestion(timeUsed, currentGuesses.value.length);
      
      const score = calculateChallengeScore(
        isCorrect,
        timeUsed,
        currentGuesses.value.length,
        challengeSettings.value
      );
      
      challengeScore.value += score;
      challengeResults.value.push({
        questionIndex: currentQuestionIndex.value,
        targetOperator: currentQuestion.value.targetOperator,
        guesses: [...currentGuesses.value],
        comparisons: [...currentComparisons.value],
        isCorrect,
        timeUsed,
        score
      });
      
      // 1.5秒后进入下一题
      setTimeout(() => {
        nextQuestion();
      }, 1500);
    };

    // 下一题
    const nextQuestion = () => {
      currentQuestionIndex.value++;
      if (currentQuestionIndex.value < challengeQuestions.value.length) {
        startQuestion();
      } else {
        finishChallenge();
      }
    };

    // 完成挑战
    const finishChallenge = () => {
      if (gameTimer) {
        clearInterval(gameTimer);
        gameTimer = null;
      }
      if (totalTimer) {
        clearInterval(totalTimer);
        totalTimer = null;
      }
      
      // 完成挑战，通知成就系统
      achievementChecker.completeChallenge(challengeResults.value);
      
      // 检查最终成就
      const finalAchievements = achievementChecker.checkFinalAchievements();
      achievementEmitter.emitAchievements(finalAchievements);
      
      challengePhase.value = 'result';
    };

    // 重新开始
    const restartChallenge = () => {
      challengePhase.value = 'setup';
      challengeQuestions.value = [];
      currentQuestionIndex.value = 0;
      challengeScore.value = 0;
      challengeResults.value = [];
    };



    // 获取模式标签
    const getModeTags = (mode) => {
      const modeMap = {
        easy: ['性别', '星级', '职业', '国家', '种族', '源石技艺适应性', '身高', '感染状态', '出生日期', '标签'],
        hard: ['星级', '满级攻击', '满级生命', '满级防御', '满级法术抗性', '攻击间隔', '上线年份', '标签']
      };
      return modeMap[mode] || [];
    };

    // 获取模式显示名称
    const getModeDisplayName = (mode) => {
      const nameMap = {
        easy: '大头',
        hard: '兔头', 
        puzzle: '小头'
      };
      return nameMap[mode] || mode;
    };

    // 获取选中的标签组
    const getSelectedTagGroup = () => {
      const tagMap = {
        easy: {
          id: 'easy',
          tags: ['性别', '星级', '职业', '国家', '种族', '源石技艺适应性', '身高', '感染状态', '出生日期', '标签']
        },
        hard: {
          id: 'hard',
          tags: ['星级', '满级攻击', '满级生命', '满级防御', '满级法术抗性', '攻击间隔', '上线年份', '标签']
        }
      };
      return tagMap[challengeSettings.value.gameMode] || tagMap.easy;
    };

    // 格式化时间
    const formatTime = (seconds) => {
      if (seconds === Infinity || seconds >= 300) {
        return '∞';
      }
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // 格式化总时间
    const formatTotalTime = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // 清理
    onBeforeUnmount(() => {
      if (gameTimer) {
        clearInterval(gameTimer);
      }
      if (totalTimer) {
        clearInterval(totalTimer);
      }
    });

    return {
      challengePhase,
      challengeSettings,
      challengeQuestions,
      currentQuestionIndex,
      challengeScore,
      challengeResults,
      timeLeft,
      preparingProgress,
      currentQuestion,
      currentGuesses,
      currentComparisons,
      gameOver,
      gameWon,
      canStartChallenge,
      startChallenge,
      handleGuess,
      nextQuestion,
      restartChallenge,
      getModeDisplayName,
      formatTime,
      formatTotalTime,
      totalChallengeTime
    };
  }
};
</script>

<style scoped>
.challenge-board {
  width: 100%;
  max-width: 1000px;
  margin: 0 auto;
}

/* 设置阶段样式 */
.challenge-setup {
  background: linear-gradient(135deg, 
    var(--color-card-bg), 
    rgba(59, 130, 246, 0.05)
  );
  border-radius: 16px;
  padding: 2rem;
  border: 1px solid var(--color-border);
  box-shadow: 
    0 4px 20px rgba(0, 0, 0, 0.08),
    0 1px 3px rgba(0, 0, 0, 0.1);
  position: relative;
}

.challenge-setup::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, 
    rgba(59, 130, 246, 0.03), 
    rgba(147, 51, 234, 0.02)
  );
  border-radius: 16px;
  pointer-events: none;
}

[data-theme="dark"] .challenge-setup {
  background: linear-gradient(135deg, 
    var(--color-card-bg), 
    rgba(59, 130, 246, 0.08)
  );
  box-shadow: 
    0 4px 20px rgba(0, 0, 0, 0.25),
    0 1px 3px rgba(0, 0, 0, 0.15);
}

[data-theme="dark"] .challenge-setup::before {
  background: linear-gradient(135deg, 
    rgba(59, 130, 246, 0.06), 
    rgba(147, 51, 234, 0.04)
  );
}

.setup-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
  text-align: center;
  justify-content: center;
}

.setup-icon {
  font-size: 2rem;
}

.setup-title {
  margin: 0;
  font-size: 1.8rem;
  font-weight: 600;
  color: var(--color-text);
}

.setup-section {
  margin-bottom: 2rem;
}

.section-title {
  margin: 0 0 1rem 0;
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--color-text);
}

.mode-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.mode-card {
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid var(--color-border);
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.mode-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.mode-card.active {
  border-color: var(--color-primary);
  background: linear-gradient(135deg, 
    rgba(59, 130, 246, 0.15), 
    rgba(147, 51, 234, 0.08)
  );
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.mode-name {
  font-weight: 600;
  font-size: 1.2rem;
  margin-bottom: 0.5rem;
  color: var(--color-text);
}

.mode-desc {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
}

.param-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.param-item {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 1rem;
}

.param-label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: var(--color-text);
}

.param-control {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.modern-range {
  flex: 1;
  -webkit-appearance: none;
  height: 6px;
  border-radius: 3px;
  background: var(--color-border);
  outline: none;
}

.modern-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-primary);
  cursor: pointer;
}

.param-value {
  font-weight: 600;
  color: var(--color-primary);
  min-width: 60px;
}

.toggle-group {
  display: flex;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.toggle-option {
  flex: 1;
  padding: 0.75rem 1rem;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.3s ease;
  color: var(--color-text);
}

.toggle-option.active {
  background: var(--color-primary);
  color: white;
}

.setup-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: 2rem;
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

.primary-btn:hover:not(:disabled) {
  background: var(--color-primary-hover);
  transform: translateY(-2px);
}

.primary-btn:disabled {
  background: var(--color-border);
  cursor: not-allowed;
}

.secondary-btn {
  background: transparent;
  border: 2px solid var(--color-border);
  color: var(--color-text);
}

.secondary-btn:hover {
  border-color: var(--color-primary);
}

/* 准备阶段样式 */
.challenge-preparing {
  text-align: center;
  padding: 3rem;
}

.preparing-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.preparing-title {
  font-size: 1.8rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--color-text);
}

.preparing-desc {
  font-size: 1rem;
  color: var(--color-text-secondary);
  margin-bottom: 2rem;
}

.progress-container {
  max-width: 300px;
  margin: 0 auto;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: var(--color-border);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary), var(--color-primary-hover));
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-text {
  font-weight: 600;
  color: var(--color-primary);
}

/* 游戏进行阶段样式 */
.challenge-playing {
  width: 100%;
}

.challenge-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, 
    var(--color-card-bg), 
    rgba(34, 197, 94, 0.05)
  );
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1rem 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.status-left {
  display: flex;
  gap: 2rem;
  align-items: center;
}

.status-right {
  display: flex;
  gap: 1.5rem;
  align-items: center;
}

.total-timer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}

.question-counter, .score-display {
  font-weight: 600;
  color: var(--color-text);
}

.timer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: var(--color-text);
  transition: color 0.3s ease;
}

.timer.warning {
  color: #ef4444;
  animation: flash 1s infinite;
}

@keyframes flash {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.timer-icon {
  font-size: 1.2rem;
}

.current-question {
  width: 100%;
}

.question-board {
  width: 100%;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .challenge-setup {
    padding: 1.5rem;
  }
  
  .setup-title {
    font-size: 1.5rem;
  }
  
  .mode-grid {
    grid-template-columns: 1fr;
  }
  
  .param-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  .setup-actions {
    flex-direction: column;
  }
  
  .challenge-status {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }
  
  .status-left {
    justify-content: center;
  }
}
</style>