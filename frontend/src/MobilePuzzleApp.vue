<template>
  <div class="mobile-puzzle-app">
    <!-- 背景装饰 -->
    <div class="bg-pattern"></div>
    
    <div class="mobile-container">
      <!-- 头部区域 -->
      <div class="header-section">
        <!-- 角色图片区域 -->
        <div class="character-portrait">
          <div class="character-image">
            <div class="placeholder-image">
              <span class="authority-text">权威</span>
            </div>
          </div>
          
          <!-- 右上角标题 -->
          <div class="title-overlay">
            <div class="main-title">泰拉鉴定大师</div>
            <div class="subtitle">坎诺特</div>
          </div>
        </div>
      </div>
      
      <!-- 输入区域 -->
      <div class="input-section">
        <div class="mobile-guess-input">
          <guess-input
            :operators="operators"
            :disabled="gameOver"
            :guessedOperators="guesses"
            @submit="onGuessSubmit"
            class="mobile-search"
          />
        </div>
        <div class="game-info">请通过像素化立绘，逐步鉴定出干员身份</div>
      </div>
      
      
      <!-- 拼图区域 -->
      <div class="puzzle-section">
        <puzzle-board
          v-if="targetOperator"
          :operators="operators"
          :targetOperator="targetOperator"
          :maxGuesses="maxGuesses"
          :gameOver="gameOver"
          :gameWon="gameWon"
          :userGaveUp="false"
          :guesses="guesses"
          :gameSessionId="gameSessionId"
          :puzzleHintInterval="2"
          @reset="resetGame"
          class="mobile-puzzle-board"
        />
      </div>
      
      <!-- 底部区域 -->
      <div class="footer-section">
        <div class="footer-title">泰拉鉴定大师课毕业考试</div>
        <div class="footer-credits">
          游戏内素材来源：prts.wiki &nbsp; AndyBlocker © 2025
        </div>
      </div>
    </div>
    
    <!-- 结果弹窗 -->
    <div v-if="showResult" class="result-modal" @click="hideResult">
      <div class="result-content" @click.stop>
        <div class="result-text">{{ resultMessage }}</div>
        <div v-if="gameOver || gameWon" class="result-actions">
          <button @click="resetGame" class="reset-btn">
            重新开始
          </button>
        </div>
        <div v-else class="result-actions">
          <button @click="hideResult" class="continue-btn">
            继续游戏
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, nextTick, computed } from 'vue';
import { loadOperatorsData } from './utils/dataLoader';
import { selectRandomOperator, preprocessOperators } from './logic/gameLogic';
import GuessInput from './components/GuessInput.vue';
import PuzzleBoard from './components/PuzzleBoard.vue';

export default {
  name: 'MobilePuzzleApp',
  components: {
    GuessInput,
    PuzzleBoard
  },
  setup() {
    // 响应式数据
    const operators = ref([]);
    const targetOperator = ref(null);
    const guesses = ref([]);
    const gameOver = ref(false);
    const gameWon = ref(false);
    const showResult = ref(false);
    const resultMessage = ref('');
    const showHint = ref(false);
    const currentHint = ref('');
    
    // 游戏配置
    const maxGuesses = ref(6);
    const gameSessionId = ref(Date.now().toString());
    
    // 计算属性
    const filteredOperators = computed(() => {
      // 如果没有干员数据，返回空数组
      if (!operators.value || operators.value.length === 0) {
        return [];
      }
      // 移动端不限制只有6星，使用4星以上的干员
      return operators.value.filter(op => (op.星级 || 0) >= 4);
    });
    
    
    
    // 初始化游戏
    const initGame = async () => {
      try {
        // 加载干员数据
        const data = await loadOperatorsData('./data/operators.json');
        
        // 预处理干员数据（重要！转换星级等字段）
        preprocessOperators(data);
        operators.value = data;
        
        console.log(`加载了 ${data.length} 个干员，过滤后有 ${filteredOperators.value.length} 个可用干员`);
        
        // 开始新游戏
        startNewGame();
        
        // 隐藏加载屏幕
        await nextTick();
        const loadingScreen = document.getElementById('loading-screen');
        const app = document.getElementById('app');
        if (loadingScreen) {
          loadingScreen.style.display = 'none';
        }
        if (app) {
          app.classList.add('loaded');
        }
        
      } catch (error) {
        console.error('初始化失败:', error);
        showResultMessage('数据加载失败，请刷新页面重试');
      }
    };
    
    // 开始新游戏
    const startNewGame = () => {
      // 重置游戏状态
      guesses.value = [];
      gameOver.value = false;
      gameWon.value = false;
      showHint.value = false;
      hideResult();
      
      // 生成新的游戏会话ID
      gameSessionId.value = Date.now().toString();
      
      // 随机选择目标干员
      const availableOperators = filteredOperators.value;
      if (availableOperators.length === 0) {
        showResultMessage('没有可用的干员数据');
        return;
      }
      
      targetOperator.value = selectRandomOperator(availableOperators);
      console.log('目标干员:', targetOperator.value?.干员);
    };
    
    
    // 提交猜测
    const submitGuess = (operatorName) => {
      if (!operatorName || gameOver.value) return;
      
      // 查找干员
      const guessedOperator = operators.value.find(op => 
        op.干员 === operatorName || 
        op.干员.replace(/[·\u00B7\u2022\u2027]/g, '') === operatorName.replace(/[·\u00B7\u2022\u2027]/g, '')
      );
      
      if (!guessedOperator) {
        showResultMessage(`未找到干员: ${operatorName}`, 2000);
        return;
      }
      
      // 添加猜测
      guesses.value.push(guessedOperator);
      
      // 检查是否正确
      if (guessedOperator.干员 === targetOperator.value.干员) {
        gameWon.value = true;
        gameOver.value = true;
        showResultMessage(`🎉 恭喜！正确答案是: ${targetOperator.value.干员}`);
      } else {
        // 显示提示
        if (guesses.value.length % 2 === 0) {
          displayHint();
        }
        
        // 检查是否用完次数
        if (guesses.value.length >= maxGuesses.value) {
          gameOver.value = true;
          showResultMessage(`😢 游戏结束！正确答案是: ${targetOperator.value.干员}`);
        }
      }
    };
    
    // 显示提示
    const displayHint = () => {
      if (!targetOperator.value) return;
      
      const hints = [
        `职业: ${targetOperator.value.职业}`,
        `星级: ${targetOperator.value.星级}星`,
        `国家: ${targetOperator.value.国家}`,
        `种族: ${targetOperator.value.种族}`
      ];
      
      const randomHint = hints[Math.floor(Math.random() * hints.length)];
      currentHint.value = randomHint;
      showHint.value = true;
      
      setTimeout(() => {
        showHint.value = false;
      }, 3000);
    };
    
    // 显示结果消息
    const showResultMessage = (message, timeout = 0) => {
      resultMessage.value = message;
      showResult.value = true;
      
      // 只有在游戏未结束时才自动隐藏
      if (timeout > 0 && !gameOver.value && !gameWon.value) {
        setTimeout(() => {
          showResult.value = false;
        }, timeout);
      }
    };
    
    // 隐藏结果
    const hideResult = () => {
      showResult.value = false;
    };
    
    // 处理GuessInput组件的提交
    const onGuessSubmit = (operatorName) => {
      submitGuess(operatorName);
    };
    
    // 重置游戏
    const resetGame = () => {
      hideResult();
      startNewGame();
    };
    
    
    
    // 生命周期
    onMounted(() => {
      initGame();
    });
    
    return {
      // 数据
      operators,
      targetOperator,
      guesses,
      gameOver,
      gameWon,
      showResult,
      resultMessage,
      showHint,
      currentHint,
      maxGuesses,
      gameSessionId,
      
      // 方法
      onGuessSubmit,
      resetGame,
      hideResult
    };
  }
};
</script>

<style scoped>
.mobile-puzzle-app {
  width: 100%;
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
}

.bg-pattern {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  opacity: 0.05;
  background-image: 
    radial-gradient(circle at 25% 25%, #dc3545 2px, transparent 2px),
    radial-gradient(circle at 75% 75%, #dc3545 1px, transparent 1px);
  background-size: 50px 50px;
  background-position: 0 0, 25px 25px;
  pointer-events: none;
}

.mobile-container {
  width: 100%;
  max-width: 450px;
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 1;
}

.header-section {
  padding: 20px;
  position: relative;
  z-index: 10;
  height: 280px; /* 匹配示例图片比例 */
}

.character-portrait {
  position: relative;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.8) 100%);
  border-radius: 12px;
  overflow: hidden;
}

.character-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}


.placeholder-image {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a4a3a 0%, #0f2a1f 100%);
}

.authority-text {
  font-size: 72px;
  font-weight: 900;
  color: #dc3545;
  text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.8);
  transform: rotate(-15deg);
  font-family: 'SimHei', 'Microsoft YaHei', sans-serif;
}

.title-overlay {
  position: absolute;
  top: 20px;
  right: 20px;
  text-align: right;
  z-index: 20;
}

.main-title {
  font-size: 20px;
  font-weight: bold;
  color: #ffffff;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
  margin-bottom: 4px;
  line-height: 1.2;
}

.subtitle {
  font-size: 14px;
  color: #e0e0e0;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  font-weight: 500;
}

.input-section {
  padding: 0 20px 20px;
  z-index: 5;
}

.mobile-guess-input {
  width: 100%;
}

/* 移动端GuessInput组件样式适配 */
.mobile-search ::v-deep(.guess-input-container) {
  width: 100%;
  font-size: 16px;
}

.mobile-search ::v-deep(.input-wrapper) {
  background-color: var(--color-card-bg);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.mobile-search ::v-deep(.operator-search-input) {
  font-size: 16px;
  padding: 16px 16px 16px 48px;
  border: 2px solid var(--color-border);
  transition: all var(--transition-duration);
  background-color: transparent;
  color: var(--color-text);
}

.mobile-search ::v-deep(.operator-search-input:focus) {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.mobile-search ::v-deep(.operator-search-input::placeholder) {
  color: #8c9db5;
}

.mobile-search ::v-deep(.submit-button) {
  padding: 0 28px;
  height: 52px;
  background-color: var(--color-primary);
  color: white;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--transition-duration);
}

.mobile-search ::v-deep(.submit-button:hover:not(:disabled)) {
  background-color: var(--color-primary-hover);
}

.mobile-search ::v-deep(.submit-button:disabled) {
  background-color: #bdc3c7;
  cursor: not-allowed;
}

.mobile-search ::v-deep(.suggestions-dropdown) {
  background-color: var(--color-card-bg);
  border-radius: 8px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(20px);
  border: 2px solid var(--color-primary);
}

.mobile-search ::v-deep(.suggestion-item) {
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: 1px solid var(--color-border);
}

.mobile-search ::v-deep(.suggestion-item:hover),
.mobile-search ::v-deep(.suggestion-item.active),
.mobile-search ::v-deep(.suggestion-item:focus) {
  background-color: rgba(255,255,255,0.1);
}

.mobile-search ::v-deep(.suggestion-item:last-child) {
  border-bottom: none;
}

.mobile-search ::v-deep(.operator-name) {
  font-weight: 600;
  font-size: 16px;
  margin-bottom: 2px;
  color: var(--color-text);
}

.mobile-search ::v-deep(.operator-details) {
  display: flex;
  font-size: 12px;
  color: #888;
  gap: 8px;
}

.mobile-search ::v-deep(.operator-profession) {
  background-color: #eef2f7;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.mobile-search ::v-deep(.operator-pinyin) {
  color: #8c9db5;
  font-style: italic;
}

.mobile-search ::v-deep(.no-results) {
  background-color: var(--color-card-bg);
  border-radius: 8px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
  text-align: center;
  color: #888;
  backdrop-filter: blur(20px);
  border: 2px solid var(--color-primary);
}

.mobile-search ::v-deep(.already-guessed) {
  color: #ff9800;
  font-weight: 500;
}

.input-container {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.guess-input {
  flex: 1;
  padding: 12px 16px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.9);
  color: #333;
  font-size: 16px;
  outline: none;
}

.guess-input::placeholder {
  color: #666;
}

.guess-input:disabled {
  background: rgba(255, 255, 255, 0.5);
  color: #999;
}

.submit-btn {
  padding: 12px 20px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}

.submit-btn:hover:not(:disabled) {
  background: #c82333;
}

.submit-btn:disabled {
  background: #666;
  cursor: not-allowed;
}

.game-info {
  text-align: center;
  color: #cccccc;
  font-size: 14px;
  margin-bottom: 10px;
}

.guess-counter {
  text-align: center;
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 20px;
  color: #ffffff;
}

.hint-section {
  padding: 10px 20px;
  text-align: center;
  color: #ffeb3b;
  font-size: 14px;
  background: rgba(255, 235, 59, 0.1);
  margin: 0 20px 20px;
  border-radius: 8px;
  border: 1px solid rgba(255, 235, 59, 0.3);
}

.puzzle-section {
  flex: 1;
  padding: 0 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 300px;
}

/* 移动端PuzzleBoard适配 */
.mobile-puzzle-board {
  width: 100%;
  max-width: 100%;
}

.mobile-puzzle-board ::v-deep(.puzzle-board) {
  margin-top: 0;
  padding: 0;
}

.mobile-puzzle-board ::v-deep(.game-status) {
  margin-bottom: 15px;
}

.mobile-puzzle-board ::v-deep(.status-message) {
  font-size: 16px;
  padding: 10px;
  max-width: 100%;
}

.mobile-puzzle-board ::v-deep(.attempts-counter) {
  font-size: 16px;
  font-weight: bold;
  color: white;
}

.mobile-puzzle-board ::v-deep(.puzzle-hints) {
  margin-bottom: 15px;
  background: rgba(255, 235, 59, 0.1);
  border-radius: 8px;
  padding: 12px;
  border: 1px solid rgba(255, 235, 59, 0.3);
}

.mobile-puzzle-board ::v-deep(.hints-header) {
  margin-bottom: 8px;
}

.mobile-puzzle-board ::v-deep(.hints-title) {
  font-size: 14px;
  margin: 0;
}

.mobile-puzzle-board ::v-deep(.hints-grid) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.mobile-puzzle-board ::v-deep(.hint-card) {
  background: rgba(255, 255, 255, 0.1);
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
}

.mobile-puzzle-board ::v-deep(.hint-label) {
  font-weight: bold;
  margin-bottom: 2px;
}

.mobile-puzzle-board ::v-deep(.hint-value) {
  color: #ffeb3b;
}

.mobile-puzzle-board ::v-deep(.final-image) {
  width: 100%;
  height: auto;
  display: block;
  border: none;
  box-shadow: none;
  border-radius: 0;
  background: transparent;
}

.mobile-puzzle-board ::v-deep(.final-compare-container) {
  display: flex;
  gap: 10px;
}

.mobile-puzzle-board ::v-deep(.final-compare-left),
.mobile-puzzle-board ::v-deep(.final-compare-right) {
  flex: 1;
}

.mobile-puzzle-board ::v-deep(.image-loading-indicator) {
  text-align: center;
  padding: 40px 20px;
  color: white;
}

.mobile-puzzle-board ::v-deep(.loading-spinner) {
  width: 30px;
  height: 30px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top: 3px solid #dc3545;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 15px;
}

.mobile-puzzle-board ::v-deep(.loading-text) {
  font-size: 14px;
  margin-bottom: 10px;
}

.mobile-puzzle-board ::v-deep(.loading-progress) {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  overflow: hidden;
}

.mobile-puzzle-board ::v-deep(.progress-bar) {
  height: 100%;
  background: #dc3545;
  transition: width 0.3s ease;
}

.mobile-puzzle-board ::v-deep(.retry-button) {
  margin-top: 15px;
  padding: 8px 16px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.mobile-puzzle-board ::v-deep(.guesses-container) {
  margin: 15px 0;
  display: none; /* 在移动端隐藏已猜干员列表，节省空间 */
}

.mobile-puzzle-board ::v-deep(.game-controls) {
  margin-top: 15px;
  text-align: center;
  display: none; /* 隐藏PuzzleBoard自带的重新开始按钮，使用我们的结果弹窗 */
}

.mobile-puzzle-board ::v-deep(.reset-button) {
  display: none;
}


.puzzle-image {
  width: 100%;
  height: 100%;
  display: block;
  
  /* 像素化渲染优化 */
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
  image-rendering: -webkit-optimize-contrast;
  
  /* 防止模糊 */
  -ms-interpolation-mode: nearest-neighbor;
  
  /* Canvas特定优化 */
  background: transparent;
  border: none;
  outline: none;
}

.puzzle-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: white;
  font-size: 14px;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid #dc3545;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.logo-section {
  position: absolute;
  bottom: 80px;
  right: 20px;
  z-index: 10;
}

.game-logo {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #dc3545;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: bold;
  color: white;
  border: 3px solid rgba(255, 255, 255, 0.3);
}

.footer-section {
  padding: 20px;
  text-align: center;
  background: rgba(0, 0, 0, 0.3);
  margin-top: auto;
}

.footer-title {
  font-size: 28px;
  font-weight: 900;
  margin-bottom: 8px;
  color: #ffffff;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
  font-family: 'SimHei', 'Microsoft YaHei', sans-serif;
}

.footer-credits {
  font-size: 12px;
  color: #888;
  line-height: 1.4;
}

.result-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.result-content {
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 30px;
  border-radius: 12px;
  text-align: center;
  min-width: 250px;
  border: 2px solid rgba(255, 255, 255, 0.2);
}

.result-text {
  font-size: 16px;
  margin-bottom: 20px;
  line-height: 1.5;
}

.result-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.reset-btn, .continue-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}

.reset-btn {
  background: #dc3545;
  color: white;
}

.reset-btn:hover {
  background: #c82333;
}

.continue-btn {
  background: #28a745;
  color: white;
}

.continue-btn:hover {
  background: #218838;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* ===== 移动端排版修复补丁 ===== */
/* 问题1&2: 搜索框布局 + 下拉列表定位 */
.mobile-search {
  position: relative;
}

.mobile-search ::v-deep(.input-wrapper) {
  display: flex;
  align-items: center;
  border-radius: 8px;
  overflow: hidden;
}

.mobile-search ::v-deep(.operator-search-input) {
  flex: 1 1 auto;
  border-radius: 8px 0 0 8px;
}

/* 问题8: 按钮圆角统一 */
.mobile-search ::v-deep(.submit-button) {
  border-radius: 0 8px 8px 0;
}

/* 问题7: 下拉列表高度响应式 */
.mobile-search ::v-deep(.suggestions-dropdown) {
  max-height: 50vh;
}

/* 问题3&4: 拼图容器宽度兼容 + aspect-ratio备份 */
.puzzle-section ::v-deep(.puzzle-container),
.mobile-puzzle-board ::v-deep(.mosaic-container),
.mobile-puzzle-board ::v-deep(.final-image-container),
.mobile-puzzle-board ::v-deep(.final-compare-container) {
  width: min(calc(100vw - 40px), 280px);
  position: relative;
  margin: 0 auto;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
  background: transparent !important;
}

/* aspect-ratio备份方案 */
.puzzle-section ::v-deep(.puzzle-container)::before,
.mobile-puzzle-board ::v-deep(.mosaic-container)::before {
  content: '';
  display: block;
  padding-top: 100%;
}

.puzzle-section ::v-deep(.puzzle-container) > *,
.mobile-puzzle-board ::v-deep(.mosaic-container) > * {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none !important;
  box-shadow: none !important;
  border-radius: 0 !important;
}

/* 现代浏览器使用aspect-ratio */
@supports(aspect-ratio: 1/1) {
  .puzzle-section ::v-deep(.puzzle-container),
  .mobile-puzzle-board ::v-deep(.mosaic-container) {
    padding-top: 0;
    aspect-ratio: 1/1;
  }
  
  .puzzle-section ::v-deep(.puzzle-container)::before,
  .mobile-puzzle-board ::v-deep(.mosaic-container)::before {
    display: none;
  }
  
  .puzzle-section ::v-deep(.puzzle-container) > *,
  .mobile-puzzle-board ::v-deep(.mosaic-container) > * {
    position: static;
    inset: auto;
    width: 100%;
    height: auto;
  }
}

/* 问题5: 结果弹窗Safe-Area处理 */
.result-modal {
  padding: env(safe-area-inset-top, 0) 20px 20px;
  padding-bottom: env(safe-area-inset-bottom, 20px);
}

/* 问题9: 背景层避免拦截点击 */
.bg-pattern {
  z-index: -1;
}

/* 额外的移动端优化 */
.mobile-container {
  padding-left: env(safe-area-inset-left, 0);
  padding-right: env(safe-area-inset-right, 0);
}

/* 确保Canvas在定位容器中正确显示 */
.mobile-puzzle-board ::v-deep(canvas) {
  width: 100% !important;
  height: 100% !important;
  max-width: 100% !important;
  max-height: 100% !important;
  object-fit: contain !important;
  border: none !important;
  box-shadow: none !important;
  border-radius: 0 !important;
  background: transparent !important;
  display: block !important;
}

/* 修复搜索图标在flex布局中的对齐 */
.mobile-search ::v-deep(.search-icon) {
  display: none;
}

/* 优化无结果提示的位置 */
.mobile-search ::v-deep(.no-results) {
  max-height: 50vh;
  overflow-y: auto;
}

/* ===== PuzzleBoard兼容性专项修复 ===== */
/* 强制移除所有可能的白边和装饰 */
.mobile-puzzle-board,
.mobile-puzzle-board ::v-deep(.puzzle-board),
.puzzle-section {
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
  margin: 0 !important;
  background: transparent !important;
}

/* 确保容器尺寸完全一致 */
.puzzle-section,
.mobile-puzzle-board ::v-deep(.mosaic-container),
.mobile-puzzle-board ::v-deep(.final-image-container) {
  width: min(calc(100vw - 40px), 280px) !important;
  max-width: min(calc(100vw - 40px), 280px) !important;
  margin: 0 auto !important;
  overflow: hidden !important;
}

/* Canvas强制匹配容器尺寸 */
.mobile-puzzle-board ::v-deep(canvas),
.mobile-puzzle-board ::v-deep(.final-image) {
  width: 100% !important;
  height: 100% !important;
  max-width: 100% !important;
  max-height: 100% !important;
  min-width: 100% !important;
  min-height: 100% !important;
  border: none !important;
  outline: none !important;
  box-shadow: none !important;
  border-radius: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  object-fit: cover !important;
  image-rendering: pixelated !important;
  image-rendering: -moz-crisp-edges !important;
  image-rendering: crisp-edges !important;
}

/* 移动端特殊兼容性 */
@media screen and (max-width: 768px) {
  .puzzle-section,
  .mobile-puzzle-board ::v-deep(.mosaic-container),
  .mobile-puzzle-board ::v-deep(.final-image-container) {
    width: calc(100vw - 40px) !important;
    max-width: calc(100vw - 40px) !important;
  }
}

/* 超小屏幕兼容 */
@media screen and (max-width: 360px) {
  .puzzle-section,
  .mobile-puzzle-board ::v-deep(.mosaic-container),
  .mobile-puzzle-board ::v-deep(.final-image-container) {
    width: calc(100vw - 20px) !important;
    max-width: calc(100vw - 20px) !important;
  }
  
  .mobile-container {
    padding-left: 10px;
    padding-right: 10px;
  }
}

/* 高DPI屏幕优化 */
@media screen and (-webkit-min-device-pixel-ratio: 2),
       screen and (min-resolution: 192dpi) {
  .mobile-puzzle-board ::v-deep(canvas) {
    image-rendering: -webkit-optimize-contrast !important;
    -ms-interpolation-mode: nearest-neighbor !important;
  }
}

/* 头部布局响应式适配 */
@media screen and (max-width: 360px) {
  .header-section {
    height: 240px;
    padding: 15px;
  }
  
  .authority-text {
    font-size: 56px;
  }
  
  .main-title {
    font-size: 16px;
  }
  
  .subtitle {
    font-size: 12px;
  }
  
  .footer-title {
    font-size: 24px;
  }
}

@media screen and (max-width: 320px) {
  .header-section {
    height: 200px;
    padding: 10px;
  }
  
  .authority-text {
    font-size: 48px;
  }
  
  .title-overlay {
    top: 15px;
    right: 15px;
  }
}
</style>