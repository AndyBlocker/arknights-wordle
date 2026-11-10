<template>
  <div class="mobile-puzzle-app">
    <!-- 背景装饰 -->
    <div class="bg-pattern"></div>
    
    <div class="mobile-container">
      <!-- 全局背景图片 -->
      <div class="background-image">
        <!-- 背景图层 -->
        <img :src="bgImagePath" alt="背景" class="bg-image" />
        <!-- 遮罩层（可选，用于调整对比度） -->
        <div class="image-overlay"></div>
      </div>
      
      <!-- 头部区域 -->
      <div class="header-section">
        <!-- 角色图片区域 -->
        <div class="character-portrait">
        </div>
      </div>
      
      <section v-if="loading" class="data-loading" role="status">正在加载干员数据...</section>
      <section v-else-if="loadError" class="data-error" role="alert">
        <h2>干员数据加载失败</h2>
        <p>{{ loadError }}</p>
        <button type="button" @click="initGame">重新加载数据</button>
      </section>

      <!-- 游戏状态显示 -->
      <div v-if="gameWon || gameOver" class="game-result-banner" :class="guessRating">
        <div class="result-content">
          <div v-if="gameWon" class="success-message">
            <div class="rating-header">
              <span v-if="guessRating === 'perfect'">🏆 超大杯学员！</span>
              <span v-else-if="guessRating === 'excellent'">⭐ 大杯学员！</span>
              <span v-else-if="guessRating === 'good'">👍 中杯学员！</span>
            </div>
            正确答案是: {{ targetOperator?.干员 }}
            <div class="attempts-info">鉴定次数: {{ guesses.length }}/{{ maxGuesses }}</div>
          </div>
          <div v-else class="failure-message">
            <div class="rating-header">❌ 小杯学员！</div>
            正确答案是: {{ targetOperator?.干员 }}
            <div class="attempts-info">已用完 {{ maxGuesses }} 次机会</div>
          </div>
          <div class="game-actions">
            <button @click="showResetConfirm = true" class="restart-btn">
              再来一次
            </button>
          </div>
        </div>
      </div>

      <!-- 输入区域 -->
      <div v-if="!loading && !loadError" class="input-section">
        <div class="mobile-guess-input">
          <guess-input
            :operators="operators"
            :disabled="gameOver || gameWon || !targetOperator || puzzleLoadState !== 'ready'"
            :guessedOperators="guesses"
            @submit="onGuessSubmit"
            class="mobile-search"
          />
        </div>
        <div v-if="!gameWon && !gameOver" class="game-info">提示：星级、性别、阵营、种族、职业</div>
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
          :puzzleHintInterval="1"
          :customArtSelector="selectPuzzleArt"
          :customHints="generateCustomHints"
          :customTexts="{
            winMessage: '恭喜你答对了！',
            gameOverMessage: '考试结束！',
            giveUpMessage: '你已放弃考试！'
          }"
          @load-state="puzzleLoadState = $event"
          @reset="resetGame"
          class="mobile-puzzle-board"
        />
      </div>
      
      <!-- 已猜过的干员区域 -->
      <div v-if="guesses.length > 0" class="guesses-display-section">
        <div class="guesses-title">已提交过的干员</div>
        <div class="guesses-grid">
          <div
            v-for="(guess, index) in guesses"
            :key="index"
            class="guess-item"
            :class="{ 'correct': guess.干员 === targetOperator?.干员 }"
          >
            <div class="guess-avatar-container">
              <img 
                :src="getOperatorAvatar(guess)" 
                :alt="guess.干员" 
                class="guess-avatar"
              />
            </div>
            <div class="guess-name">{{ guess.干员 }}</div>
          </div>
        </div>
      </div>
      
      <!-- 底部区域 -->
      <div class="footer-section">
        <div class="footer-title">泰拉鉴定大师课毕业考试</div>
        <div class="footer-credits">
          游戏内素材来源：prts.wiki &nbsp; AndyBlocker © 2025
        </div>
      </div>
    </div>
    
    <!-- 重置确认弹窗 -->
    <div v-if="showResetConfirm" class="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="reset-dialog-title" @keydown="handleModalKeydown" @click="showResetConfirm = false">
      <div class="confirm-content" @click.stop>
        <div id="reset-dialog-title" class="confirm-text">确定要重新开始考试吗？</div>
        <div class="confirm-subtitle">当前进度将会丢失</div>
        <div class="confirm-actions">
          <button @click="showResetConfirm = false" class="cancel-btn">
            取消
          </button>
          <button @click="confirmReset" class="confirm-btn">
            确定重新开始
          </button>
        </div>
      </div>
    </div>

    <!-- 临时消息弹窗 -->
    <div v-if="showTempMessage" class="temp-message-modal" role="status" aria-live="polite" @click="hideTempMessage">
      <div class="temp-message-content">
        <div class="temp-message-text">{{ tempMessage }}</div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount, nextTick, computed, watch } from 'vue';
import { loadOperatorsData } from './utils/dataLoader';
import { selectRandomOperator, preprocessOperators } from './logic/gameLogic';
import { getOperatorAvatarFile, getImagePath } from './utils/imageUtils';
import { getAvailableArts } from './logic/puzzleService';
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
    const loading = ref(true);
    const loadError = ref('');
    const puzzleLoadState = ref('loading');
    let gameSequence = 0;
    let messageTimeout = null;
    let modalReturnFocus = null;
    const operators = ref([]);
    const targetOperator = ref(null);
    const guesses = ref([]);
    const gameOver = ref(false);
    const gameWon = ref(false);
    const showResetConfirm = ref(false);
    const showTempMessage = ref(false);
    const tempMessage = ref('');
    
    // 游戏配置
    const maxGuesses = ref(6);
    const gameSessionId = ref(`${Date.now()}-${gameSequence}`);
    
    // 判断是否为皮肤干员的函数
    const isSkinOperator = (operator) => {
      // 常见的皮肤标识方式：
      // 1. 干员名包含特殊后缀或标识
      // 2. 获得方式包含皮肤相关信息
      // 3. 有特殊的皮肤标记字段
      
      if (!operator || !operator.干员) return false;
      
      const operatorName = operator.干员;
      const obtainMethod = operator.获得方式 || '';
      
      // 检查干员名是否包含皮肤相关标识
      const skinNamePatterns = [
        /skin/i,
        /皮肤/,
        /时装/,
        /服装/,
        /夏日版/,
        /冬日版/,
        /圣诞版/,
        /新年版/,
        /泳装版/,
        /\[.*\]$/, // 名称末尾的方括号标识
        /_skin\d*$/i // 末尾_skin数字
      ];
      
      for (const pattern of skinNamePatterns) {
        if (pattern.test(operatorName)) {
          return true;
        }
      }
      
      // 检查获得方式是否包含皮肤相关信息
      const skinObtainPatterns = [
        /皮肤/,
        /时装/,
        /服装/,
        /skin/i,
        /外观/
      ];
      
      for (const pattern of skinObtainPatterns) {
        if (pattern.test(obtainMethod)) {
          return true;
        }
      }
      
      return false;
    };

    // 为移动端定制的提示函数
    const generateCustomHints = (targetOperator) => {
      // 按照指定顺序：星级、性别、职业、阵营、种族
      const orderedHints = [
        {
          label: '星级',
          value: () => targetOperator?.星级 || '?',
          shouldShow: () => true
        },
        {
          label: '性别',
          value: () => targetOperator?.性别 || '?',
          shouldShow: () => true
        },
        {
          label: '职业',
          value: () => targetOperator?.职业 || '?',
          shouldShow: () => true
        },
        {
          label: '阵营',
          value: () => targetOperator?.国家 || '?',
          shouldShow: () => true
        },
        {
          label: '种族',
          value: () => targetOperator?.种族 || '?',
          shouldShow: () => true
        }
      ];

      // 过滤掉不应该显示的提示
      return orderedHints.filter(hint => hint.shouldShow());
    };

    // 专门为移动端拼图模式设计的立绘选择函数
    const selectPuzzleArt = (operator, gameSessionId) => {
      const list = getAvailableArts(operator);
      
      if (!list || list.length === 0) {
        return '';
      }
      
      // 排除皮肤立绘 (包含skin的文件名)
      const basicArts = list.filter(art => !art.includes('skin'));
      
      if (basicArts.length === 0) {
        return '';
      }
      
      // 优先选择精二立绘（格式为：立绘_干员名_2.png）
      const elite2Art = basicArts.find(art => art.endsWith('_2.png'));
      if (elite2Art) {
        return elite2Art;
      }
      
      // 如果没有精二立绘，选择精一立绘（格式为：立绘_干员名_1.png）
      const elite1Art = basicArts.find(art => art.endsWith('_1.png'));
      if (elite1Art) {
        return elite1Art;
      }
      
      // 如果既没有精二也没有精一立绘，返回空字符串跳过该干员
      return '';
    };

    // 计算属性
    const filteredOperators = computed(() => {
      // 如果没有干员数据，返回空数组
      if (!operators.value || operators.value.length === 0) {
        return [];
      }
      // 移动端包含所有星级的干员，只排除皮肤干员
      const filtered = operators.value.filter(op => {
        const notSkin = !isSkinOperator(op);
        return notSkin;
      });
      
      return filtered;
    });

    // 计算猜测评级
    const guessRating = computed(() => {
      if (!gameWon.value && !gameOver.value) {
        return null; // 游戏还在进行中
      }
      
      if (gameWon.value) {
        const guessCount = guesses.value.length;
        if (guessCount === 1) {
          return 'perfect'; // 1次猜中 - 完美
        } else if (guessCount <= 3) {
          return 'excellent'; // 2-3次 - 优秀
        } else if (guessCount <= 6) {
          return 'good'; // 4-6次 - 良好
        }
      }
      
      return 'failed'; // 猜测失败
    });

    // 背景图片路径 - 根据当前页面调整路径
    const bgImagePath = computed(() => {
      // 检查当前路径是否在bw子目录下
      const currentPath = window.location.pathname;
      if (currentPath.includes('/bw/')) {
        return '../bg.jpg';
      }
      return './bg.jpg';
    });
    
    
    
    // Always remove the boot overlay, including failed requests, so retry is reachable.
    const initGame = async () => {
      loading.value = true;
      loadError.value = '';
      try {
        const data = await loadOperatorsData('../data/operators.json');
        preprocessOperators(data);
        operators.value = data;
        startNewGame();
      } catch (error) {
        loadError.value = error.message || '请检查网络连接后重试';
      } finally {
        loading.value = false;
        await nextTick();
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) loadingScreen.style.display = 'none';
        document.getElementById('app')?.classList.add('loaded');
      }
    };

    // 开始新游戏
    const startNewGame = () => {
      // 重置游戏状态
      guesses.value = [];
      gameOver.value = false;
      gameWon.value = false;
      showResetConfirm.value = false;
      hideTempMessage();
      
      // 生成新的游戏会话ID
      gameSessionId.value = `${Date.now()}-${++gameSequence}`;
      puzzleLoadState.value = 'loading';
      
      // 选择有精二立绘的目标干员
      const availableOperators = filteredOperators.value;
      if (availableOperators.length === 0) {
        showTempMessageFunc('没有可用的干员数据');
        return;
      }
      
      // 筛选出有精一或精二立绘的干员（排除皮肤）
      const operatorsWithValidArt = availableOperators.filter(op => {
        const selectedArt = selectPuzzleArt(op, gameSessionId.value);
        return selectedArt !== ''; // 只保留有精一或精二立绘的干员
      });
      
      if (operatorsWithValidArt.length === 0) {
        showTempMessageFunc('没有可用的立绘干员');
        return;
      }
      
      targetOperator.value = selectRandomOperator(operatorsWithValidArt);
    };
    
    
    // 提交猜测
    const submitGuess = (operatorName) => {
      if (typeof operatorName !== 'string' || !operatorName.trim() || loading.value || loadError.value ||
          !targetOperator.value || gameOver.value || gameWon.value ||
          puzzleLoadState.value !== 'ready' || guesses.value.length >= maxGuesses.value) return;
      
      // 查找干员
      const guessedOperator = operators.value.find(op => 
        op.干员 === operatorName || 
        op.干员.replace(/[·\u00B7\u2022\u2027]/g, '') === operatorName.replace(/[·\u00B7\u2022\u2027]/g, '')
      );
      
      if (!guessedOperator) {
        showTempMessageFunc(`未找到干员: ${operatorName}`);
        return;
      }
      
      if (guesses.value.some(guess => guess.干员 === guessedOperator.干员)) {
        showTempMessageFunc('该干员已猜过');
        return;
      }

      // 添加猜测
      guesses.value.push(guessedOperator);
      
      // 检查是否正确
      if (guessedOperator.干员 === targetOperator.value.干员) {
        gameWon.value = true;
        gameOver.value = true;
      } else {
        // 不需要在这里显示提示，由PuzzleBoard组件自动处理
        
        // 检查是否用完次数
        if (guesses.value.length >= maxGuesses.value) {
          gameOver.value = true;
        }
      }
    };
    
    // 显示临时消息
    const showTempMessageFunc = (message, timeout = 2000) => {
      tempMessage.value = message;
      showTempMessage.value = true;
      
      clearTimeout(messageTimeout);
      messageTimeout = setTimeout(() => {
        showTempMessage.value = false;
      }, timeout);
    };
    
    // 隐藏临时消息
    const hideTempMessage = () => {
      showTempMessage.value = false;
    };
    
    watch(showResetConfirm, async (open) => {
      if (open) {
        modalReturnFocus = document.activeElement;
        await nextTick();
        document.querySelector('.confirm-modal button')?.focus();
      } else if (modalReturnFocus?.isConnected) {
        modalReturnFocus.focus();
      }
    });

    const handleModalKeydown = (event) => {
      if (event.key === 'Escape') {
        showResetConfirm.value = false;
        event.preventDefault();
      } else if (event.key === 'Tab') {
        const buttons = [...event.currentTarget.querySelectorAll('button')];
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          last.focus();
          event.preventDefault();
        } else if (!event.shiftKey && document.activeElement === last) {
          first.focus();
          event.preventDefault();
        }
      }
    };
    onBeforeUnmount(() => clearTimeout(messageTimeout));

    // 确认重置游戏
    const confirmReset = () => {
      showResetConfirm.value = false;
      startNewGame();
    };
    
    // 处理GuessInput组件的提交
    const onGuessSubmit = (operatorName) => {
      submitGuess(operatorName);
    };
    
    // 获取干员头像
    const getOperatorAvatar = (operator) => {
      const file = getOperatorAvatarFile(operator.干员, operator.稀有度);
      return getImagePath(file);
    };
    
    // 重置游戏（已移除，使用confirmReset代替）
    
    
    
    // 生命周期
    onMounted(() => {
      initGame();
    });
    
    return {
      // 数据
      loading,
      loadError,
      puzzleLoadState,
      initGame,
      handleModalKeydown,
      operators,
      targetOperator,
      guesses,
      gameOver,
      gameWon,
      showResetConfirm,
      showTempMessage,
      tempMessage,
      maxGuesses,
      gameSessionId,
      guessRating,
      bgImagePath,
      
      // 方法
      onGuessSubmit,
      confirmReset,
      hideTempMessage,
      getOperatorAvatar,
      selectPuzzleArt,
      generateCustomHints
    };
  }
};
</script>

<style scoped>
/* 全局确保所有元素允许触摸手势 */
* {
  touch-action: auto !important;
}

.mobile-puzzle-app {
  width: 100%;
  /* 移除限制高度的样式，使用flex布局 */
  flex: 1 0 auto;
  position: relative;
  /* 允许水平滚动和缩放 */
  overflow-x: auto;
  /* 确保触摸操作完全不受限制 */
  touch-action: auto;
  -webkit-overflow-scrolling: touch;
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
  /* 移除min-height限制，让内容自然撑开 */
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 1;
  /* 确保内容在背景图片之上 */
  flex: 1 0 auto;
}

/* 中等屏幕下增加容器宽度 */
@media screen and (min-width: 500px) and (max-width: 768px) {
  .mobile-container {
    max-width: min(90vw, 600px);
  }
}

.mobile-container > *:not(.background-image) {
  position: relative;
  z-index: 2;
}

.mobile-container .input-section {
  z-index: 999999 !important;
}

.mobile-container .puzzle-section {
  z-index: 1 !important;
}

/* 桌面端布局优化 */
@media screen and (min-width: 769px) {
  .mobile-container {
    max-width: 800px;
    padding: 20px;
  }
}

/* 超宽屏布局优化 */
@media screen and (min-width: 1200px) {
  .mobile-container {
    max-width: 900px;
    padding: 20px;
  }
}

.header-section {
  padding: 0;
  position: relative;
  z-index: 2;
  height: 160px;
  margin: 0;
  width: 100%;
  max-width: 100%;
}

/* 桌面端头部区域优化 */
@media screen and (min-width: 769px) {
  .header-section {
    height: 200px;
    padding: 0;
    margin-bottom: 20px;
  }
}

/* 超宽屏头部区域优化 */
@media screen and (min-width: 1200px) {
  .header-section {
    height: 240px;
    padding: 0;
    margin-bottom: 20px;
  }
}

.character-portrait {
  position: relative;
  width: 100%;
  height: 100%;
  /* 移除背景，让全局背景图片透过 */
  border-radius: 0;
  overflow: visible;
}


.background-image {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
  overflow: hidden;
  /* 背景图片基于viewport的尺寸进行缩放，防止DOM变化影响 */
  /* 彻底禁用背景装饰的pointer-events，避免截获触点 */
  pointer-events: none !important;
}

/* 背景装饰彻底不给事件，避免截获触点 */
.background-image,
.background-image * {
  pointer-events: none !important;
}

.bg-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* 显示图片顶部区域，确保帽子和头部完整显示 */
  object-position: center 0%;
  
  /* 确保图片质量 */
  image-rendering: high-quality;
  image-rendering: -webkit-optimize-contrast;
  
  /* 防止图片在DOM变化时重新缩放 */
  transform: scale(1);
  transform-origin: center center;
  will-change: auto;
}

.image-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  /* 增加遮罩以确保内容可读性 */
}


.input-section {
  padding: 0 20px 10px;
  z-index: 99999;
  width: 75%;
  margin: 0 auto;
  position: relative;
}

/* 手机端输入区域优化 */
@media (max-width: 768px) {
  .input-section {
    width: 90%;
    padding: 0 10px 10px;
    z-index: 999999 !important;
    position: relative !important;
  }
}

/* 桌面端输入区域优化 */
@media screen and (min-width: 769px) {
  .input-section {
    padding: 0 20px 15px;
    width: 75%;
  }
  
  .game-info {
    font-size: 16px;
    margin-bottom: 15px;
  }
}

/* 超宽屏输入区域优化 */
@media screen and (min-width: 1200px) {
  .input-section {
    padding: 0 20px 20px;
    width: 75%;
  }
  
  .game-info {
    font-size: 18px;
    margin-bottom: 20px;
  }
}

.mobile-guess-input {
  width: 100%;
}

/* 移动端GuessInput组件样式适配 */
.mobile-search ::v-deep(.guess-input-container) {
  width: 100%;
  font-size: 16px;
  z-index: 99999 !important;
  position: relative !important;
}

/* 手机端特殊处理 */
@media (max-width: 768px) {
  .mobile-search ::v-deep(.guess-input-container) {
    width: 100%;
    max-width: 100%;
    z-index: 999999 !important;
    position: relative !important;
  }
  
  .mobile-search ::v-deep(.operator-search-input) {
    font-size: 14px !important;
    padding: 0 10px 0 36px !important;
    height: 48px !important;
  }
  
  .mobile-search ::v-deep(.submit-button) {
    font-size: 14px !important;
    padding: 0 20px !important;
    height: 48px !important;
    min-width: 70px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    text-align: center !important;
    line-height: 1 !important;
  }
  
  .mobile-search ::v-deep(.search-icon) {
    left: 10px !important;
  }
  
  .mobile-search ::v-deep(.suggestions-dropdown) {
    z-index: 9999999 !important;
    position: absolute !important;
  }
  
  .mobile-search ::v-deep(.no-results) {
    z-index: 9999999 !important;
    position: absolute !important;
  }
}

.mobile-search ::v-deep(.input-wrapper) {
  background-color: var(--color-card-bg);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  align-items: stretch;
  display: flex;
}

.mobile-search ::v-deep(.operator-search-input) {
  font-size: 16px;
  padding: 0 12px 0 40px;
  border: 1px solid var(--color-border);
  border-right: none;
  transition: all var(--transition-duration);
  background-color: transparent;
  color: var(--color-text);
  height: 48px;
  box-sizing: border-box;
  line-height: 1.2;
}

/* 桌面端搜索输入框优化 */
@media screen and (min-width: 769px) {
  .mobile-search ::v-deep(.operator-search-input) {
    font-size: 18px;
    padding: 0 16px 0 48px;
    height: 48px;
    line-height: 1.2;
  }
  
  .mobile-search ::v-deep(.submit-button) {
    font-size: 18px;
    padding: 0 36px;
    height: 48px;
    min-width: 100px;
  }
}

.mobile-search ::v-deep(.operator-search-input:focus) {
  border-color: var(--color-primary);
}

.mobile-search ::v-deep(.operator-search-input::placeholder) {
  color: #8c9db5;
}

.mobile-search ::v-deep(.submit-button) {
  padding: 0 32px;
  height: 48px;
  background-color: var(--color-primary);
  color: white;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--transition-duration);
  border: 1px solid var(--color-primary);
  border-radius: 0;
  box-sizing: border-box;
  min-width: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  line-height: 1;
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
  z-index: 999999 !important;
  position: absolute !important;
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
  z-index: 999999 !important;
  position: absolute !important;
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
  min-height: 250px;
  z-index: 1;
  position: relative;
}

/* 中等屏幕下减少puzzle-section的padding */
@media screen and (min-width: 500px) and (max-width: 768px) {
  .puzzle-section {
    padding: 0 30px;
  }
}

/* 桌面端拼图区域优化 */
@media screen and (min-width: 769px) {
  .puzzle-section {
    padding: 0 40px;
    min-height: 400px;
  }
}

/* 超宽屏拼图区域优化 */
@media screen and (min-width: 1200px) {
  .puzzle-section {
    padding: 0 60px;
    min-height: 500px;
  }
}

/* 移动端PuzzleBoard适配 */
.mobile-puzzle-board {
  width: 100%;
  max-width: 100%;
  z-index: 1 !important;
  position: relative !important;
}

.mobile-puzzle-board ::v-deep(.puzzle-board) {
  margin-top: 0;
  padding: 0;
  z-index: 1 !important;
  position: relative !important;
}

.mobile-puzzle-board ::v-deep(.mosaic-container) {
  z-index: 1 !important;
  position: relative !important;
}

.mobile-puzzle-board ::v-deep(.mosaic-container canvas) {
  z-index: 1 !important;
  position: relative !important;
}

.mobile-puzzle-board ::v-deep(.final-overlay-container) {
  z-index: 1 !important;
  position: relative !important;
}

.mobile-puzzle-board ::v-deep(.overlay-mosaic),
.mobile-puzzle-board ::v-deep(.overlay-original) {
  z-index: 1 !important;
}

.mobile-puzzle-board ::v-deep(.mosaic-layer),
.mobile-puzzle-board ::v-deep(.original-layer) {
  z-index: 1 !important;
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
  /* 页脚始终贴底；内容超过一屏时就随页面滚动 */
  flex-shrink: 0;
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

/* 桌面端页脚优化 */
@media screen and (min-width: 769px) {
  .footer-title {
    font-size: 36px;
    margin-bottom: 12px;
  }
  
  .footer-credits {
    font-size: 14px;
  }
}

/* 游戏结果横幅 */
.game-result-banner {
  margin: 0 20px 20px;
  border-radius: 12px;
  padding: 20px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
}

/* 评级样式 */
.game-result-banner.perfect {
  background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
  box-shadow: 0 4px 20px rgba(255, 215, 0, 0.4);
}

.game-result-banner.excellent {
  background: linear-gradient(135deg, #32CD32 0%, #228B22 100%);
  box-shadow: 0 4px 20px rgba(50, 205, 50, 0.4);
}

.game-result-banner.good {
  background: linear-gradient(135deg, #4169E1 0%, #1E90FF 100%);
  box-shadow: 0 4px 20px rgba(65, 105, 225, 0.4);
}

.game-result-banner.failed {
  background: linear-gradient(135deg, #DC143C 0%, #B22222 100%);
  box-shadow: 0 4px 20px rgba(220, 20, 60, 0.4);
}

.game-result-banner .result-content {
  text-align: center;
  color: white;
}

.success-message {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 10px;
}

.failure-message {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 10px;
  background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
  padding: 20px;
  border-radius: 12px;
  margin: -20px -20px 10px -20px;
}

.attempts-info {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  margin-top: 5px;
}

.rating-header {
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 8px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.game-actions {
  margin-top: 15px;
  text-align: center;
  display: flex;
  justify-content: center;
  align-items: center;
}

.restart-btn {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.3);
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  display: inline-block;
  margin: 0 auto;
}

.restart-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-2px);
}

.attempts-counter {
  text-align: center;
  color: #cccccc;
  font-size: 14px;
  margin-top: 10px;
  font-weight: 500;
}

/* 桌面端游戏结果横幅优化 */
@media screen and (min-width: 769px) {
  .game-result-banner {
    margin: 0 40px 30px;
    padding: 30px;
  }
  
  .success-message, .failure-message {
    font-size: 22px;
    margin-bottom: 15px;
  }
  
  .attempts-info {
    font-size: 16px;
    margin-top: 8px;
  }
  
  .restart-btn {
    font-size: 18px;
    padding: 15px 30px;
  }
}

/* 超宽屏游戏结果横幅优化 */
@media screen and (min-width: 1200px) {
  .game-result-banner {
    margin: 0 60px 40px;
    padding: 40px;
  }
  
  .success-message, .failure-message {
    font-size: 24px;
    margin-bottom: 20px;
  }
  
  .attempts-info {
    font-size: 18px;
    margin-top: 10px;
  }
  
  .restart-btn {
    font-size: 20px;
    padding: 18px 36px;
  }
}

/* 确认弹窗 */
.confirm-modal {
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

.confirm-content {
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 30px;
  border-radius: 12px;
  text-align: center;
  min-width: 300px;
  border: 2px solid rgba(255, 255, 255, 0.2);
}

.confirm-text {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 10px;
  line-height: 1.5;
}

.confirm-subtitle {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 20px;
}

.confirm-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.cancel-btn, .confirm-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}

.cancel-btn {
  background: #6c757d;
  color: white;
}

.cancel-btn:hover {
  background: #5a6268;
}

.confirm-btn {
  background: #dc3545;
  color: white;
}

.confirm-btn:hover {
  background: #c82333;
}

/* 临时消息弹窗 */
.temp-message-modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1001;
  pointer-events: none;
}

.temp-message-content {
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 16px 24px;
  border-radius: 8px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.temp-message-text {
  font-size: 16px;
  text-align: center;
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
  height: auto !important;
  max-width: 100% !important;
  max-height: none !important;
  object-fit: contain !important;
  border: none !important;
  box-shadow: none !important;
  border-radius: 0 !important;
  background: transparent !important;
  display: block !important;
  /* 确保canvas不阻止触摸手势 */
  touch-action: auto !important;
  pointer-events: auto !important;
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
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 auto !important;
  overflow: hidden !important;
}

/* Canvas自适应容器尺寸 */
.mobile-puzzle-board ::v-deep(canvas),
.mobile-puzzle-board ::v-deep(.final-image) {
  width: 100% !important;
  height: auto !important;
  max-width: 100% !important;
  display: block !important;
  border: none !important;
  outline: none !important;
  box-shadow: none !important;
  border-radius: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  object-fit: contain !important;
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

/* 已猜过的干员显示区域 */
.guesses-display-section {
  padding: 15px 20px;
  margin: 10px 0;
  z-index: 2;
  position: relative;
}

.guesses-title {
  text-align: center;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 12px;
  opacity: 0.9;
}

.guesses-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  align-items: flex-start;
  max-width: 100%;
}

.guess-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
  min-width: 70px;
  max-width: 80px;
}

.guess-item.correct {
  background: rgba(76, 175, 80, 0.2);
  border: 1px solid rgba(76, 175, 80, 0.4);
  box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
}

.guess-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.guess-avatar-container {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  background-color: #eee;
  border: 2px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  margin-bottom: 6px;
}

.guess-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.guess-name {
  font-size: 11px;
  color: var(--color-text);
  text-align: center;
  font-weight: 500;
  line-height: 1.2;
  word-wrap: break-word;
  hyphens: auto;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 桌面端已猜干员优化 */
@media screen and (min-width: 769px) {
  .guesses-display-section {
    padding: 20px 40px;
    margin: 15px 0;
  }
  
  .guesses-title {
    font-size: 18px;
    margin-bottom: 16px;
  }
  
  .guesses-grid {
    gap: 16px;
  }
  
  .guess-item {
    padding: 10px;
    min-width: 80px;
    max-width: 90px;
  }
  
  .guess-avatar-container {
    width: 56px;
    height: 56px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    margin-bottom: 8px;
  }
  
  .guess-name {
    font-size: 12px;
  }
}

/* 超宽屏已猜干员优化 */
@media screen and (min-width: 1200px) {
  .guesses-display-section {
    padding: 25px 60px;
    margin: 20px 0;
  }
  
  .guesses-title {
    font-size: 20px;
    margin-bottom: 20px;
  }
  
  .guesses-grid {
    gap: 20px;
  }
  
  .guess-item {
    padding: 12px;
    min-width: 90px;
    max-width: 100px;
  }
  
  .guess-avatar-container {
    width: 64px;
    height: 64px;
    margin-bottom: 10px;
  }
  
  .guess-name {
    font-size: 13px;
  }
}
</style>