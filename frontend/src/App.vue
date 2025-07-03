<template>
  <div class="app-wrapper">
    <!-- 顶部Header -->
    <header class="app-header">
      <div class="header-content">
        <div class="header-main">
          <h1 class="app-title">
            <span class="title-icon">🎯</span>
            <span class="title-text">猜！干！员！</span>
          </h1>
          <button 
            class="theme-toggle" 
            @click="toggleTheme"
            :aria-label="`切换到${themeText}`"
            aria-describedby="theme-description"
          >
            <span class="theme-icon">{{ currentTheme === 'dark' ? '☀️' : '🌙' }}</span>
            <span class="theme-text">{{ themeText }}</span>
          </button>
        </div>
      </div>
      <div id="theme-description" class="sr-only">
        当前主题: {{ currentTheme === 'dark' ? '深色模式' : '浅色模式' }}
      </div>
    </header>

    <!-- 主容器 -->
    <div class="main-layout">
      <main class="app-main">
        <div v-if="loading" class="loading-container">
          <div class="loading-spinner"></div>
          <p class="loading-text">正在加载干员数据...</p>
        </div>
        <div v-else class="game-container">
          <!-- 游戏规则 -->
          <div class="rules-section">
            <div class="rules-details">
              <div class="rules-header">
                <span class="rules-icon">📋</span>
                <h3 class="rules-title">游戏规则</h3>
              </div>
              <div class="rules-content">
                <div class="rule-item">
                  <div class="rule-category">
                    <strong>感谢：</strong>
                    <span>数据、图像来源：<a href="https://prts.wiki">prts.wiki</a>，感谢<a href="https://space.bilibili.com/1546023">特鲁玛鲁@Bilibili</a>对本项目的赞助支持</span>
                  </div>
                </div>
                <div class="rule-item">
                  <div class="rule-category">
                    <strong>数值提示：</strong>
                    <span><span class="arrow-demo up-arrow">↑</span>表示答案数值更大，<span class="arrow-demo down-arrow">↓</span>表示答案数值更小</span>
                  </div>
                </div>
                <div class="rule-item">
                  <div class="rule-category">
                    <strong>颜色含义：</strong>
                    <span><span class="color-demo close">橙色</span>表示接近正确答案，<span class="color-demo far">红色</span>表示距离较远</span>
                  </div>
                </div>
                <div class="rule-item">
                  <div class="rule-category">
                    <strong>搜索方式：</strong>
                    <span>支持干员中文名称或完整拼音搜索</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 游戏模式选择 -->
          <div class="game-mode-section">
            <tag-selector
              :tagGroups="tagGroups"
              :selectedGroup="selectedTagGroup"
              @select="selectTagGroup"
              class="mode-selector"
            />
            
            <!-- 挑战模式入口 -->
            <div class="challenge-mode-entry">
              <button 
                class="challenge-btn"
                @click="enterChallengeMode"
                :disabled="loading"
              >
                <span class="challenge-icon">⚡</span>
                <div class="challenge-text">
                  <span class="challenge-title">挑战模式</span>
                  <span class="challenge-desc">限时连续猜测，挑战你的极限！</span>
                </div>
              </button>
            </div>
          </div>

          <!-- 搜索框 -->
          <div v-if="!isInChallengeMode" class="search-section">
            <guess-input
              :operators="filteredOperators"
              :disabled="gameOver || gameWon"
              :guessedOperators="guesses"
              @submit="makeGuess"
              class="main-search"
            />
          </div>

          <!-- 游戏设置 -->
          <div v-if="!isInChallengeMode" class="settings-section">
            <div v-if="selectedTagGroup.id === 'puzzle'" class="settings-card puzzle-settings">
              <div class="settings-header">
                <span class="settings-icon">⚙️</span>
                <h3>小头模式设置</h3>
                <button class="toggle-btn" @click="showAdvanced = !showAdvanced">
                  <span class="toggle-icon">{{ showAdvanced ? '➖' : '➕' }}</span>
                </button>
              </div>
              <transition name="slide-down">
                <div v-if="showAdvanced" class="settings-content">
                  <div class="setting-group">
                    <div class="setting-item">
                      <div class="setting-info">
                        <label class="setting-label">只猜六星干员</label>
                        <span class="setting-desc">限制猜测范围为6星干员</span>
                      </div>
                      <label class="modern-switch">
                        <input type="checkbox" v-model="onlySixStar" />
                        <span class="switch-slider"></span>
                      </label>
                    </div>

                    <div class="setting-item">
                      <div class="setting-info">
                        <label class="setting-label">最大猜测次数</label>
                        <span class="setting-desc">当前设置: {{ maxGuesses }} 次</span>
                      </div>
                      <div class="range-container">
                        <input type="range" min="3" max="15" v-model.number="maxGuesses" class="modern-range" />
                        <div class="range-marks">
                          <span>3</span>
                          <span>15</span>
                        </div>
                      </div>
                    </div>

                    <div class="setting-item">
                      <div class="setting-info">
                        <label class="setting-label">提示间隔</label>
                        <span class="setting-desc">每 {{ puzzleHintInterval }} 次错误猜测显示一条提示</span>
                      </div>
                      <div class="range-container">
                        <input type="range" min="1" max="5" v-model.number="puzzleHintInterval" class="modern-range" />
                        <div class="range-marks">
                          <span>1</span>
                          <span>5</span>
                        </div>
                      </div>
                    </div>

                    <div class="setting-actions">
                      <button class="action-btn give-up-btn" @click="giveUpGame" :disabled="gameOver || gameWon">
                        <span class="btn-icon">🏳️</span>
                        <span>放弃当前游戏</span>
                      </button>
                    </div>
                  </div>
                </div>
              </transition>
            </div>

            <div v-else class="settings-card normal-settings">
              <div class="settings-header">
                <span class="settings-icon">🎮</span>
                <h3>{{ selectedTagGroup.name }}模式设置</h3>
                <button class="toggle-btn" @click="showAdvanced = !showAdvanced">
                  <span class="toggle-icon">{{ showAdvanced ? '➖' : '➕' }}</span>
                </button>
              </div>
              <transition name="slide-down">
                <div v-if="showAdvanced" class="settings-content">
                  <div class="setting-group">
                    <div class="setting-item">
                      <div class="setting-info">
                        <label class="setting-label">只猜六星干员</label>
                        <span class="setting-desc">限制猜测范围为6星干员</span>
                      </div>
                      <label class="modern-switch">
                        <input type="checkbox" v-model="onlySixStar" />
                        <span class="switch-slider"></span>
                      </label>
                    </div>

                    <div v-if="selectedTagGroup.id !== 'easy'" class="setting-item">
                      <div class="setting-info">
                        <label class="setting-label">潜能设置</label>
                        <span class="setting-desc">选择干员潜能等级</span>
                      </div>
                      <div class="toggle-group">
                        <button 
                          class="toggle-option" 
                          :class="{ active: potentialMode === '0潜' }"
                          @click="potentialMode = '0潜'"
                        >
                          0潜
                        </button>
                        <button 
                          class="toggle-option" 
                          :class="{ active: potentialMode === '满潜' }"
                          @click="potentialMode = '满潜'"
                        >
                          满潜
                        </button>
                      </div>
                    </div>

                    <div v-if="selectedTagGroup.id !== 'easy'" class="setting-item">
                      <div class="setting-info">
                        <label class="setting-label">信赖设置</label>
                        <span class="setting-desc">选择干员信赖等级</span>
                      </div>
                      <div class="toggle-group">
                        <button 
                          class="toggle-option" 
                          :class="{ active: trustMode === '0信赖' }"
                          @click="trustMode = '0信赖'"
                        >
                          0信赖
                        </button>
                        <button 
                          class="toggle-option" 
                          :class="{ active: trustMode === '满信赖' }"
                          @click="trustMode = '满信赖'"
                        >
                          满信赖
                        </button>
                      </div>
                    </div>

                    <div class="setting-item">
                      <div class="setting-info">
                        <label class="setting-label">最大猜测次数</label>
                        <span class="setting-desc">当前设置: {{ maxGuesses }} 次</span>
                      </div>
                      <div class="range-container">
                        <input 
                          type="range" 
                          :max="selectedTagGroup.id === 'hard' ? 12 : 12"
                          :min="3"
                          v-model.number="maxGuesses"
                          class="modern-range"
                        />
                        <div class="range-marks">
                          <span>3</span>
                          <span>12</span>
                        </div>
                      </div>
                    </div>

                    <div class="setting-actions">
                      <button class="action-btn give-up-btn" @click="giveUpGame" :disabled="gameOver || gameWon">
                        <span class="btn-icon">🏳️</span>
                        <span>放弃当前游戏</span>
                      </button>
                    </div>
                  </div>
                </div>
              </transition>
            </div>
          </div>

          <!-- 游戏区域 -->
          <div class="game-area">
            <!-- 挑战模式 -->
            <challenge-board
              v-if="isInChallengeMode"
              :operators="filteredOperators"
              :available-modes="tagGroups"
              @back="exitChallengeMode"
              class="board-component"
            />
            
            <!-- 普通游戏模式 -->
            <template v-else>
              <game-board
                v-if="selectedTagGroup.id !== 'puzzle'"
                :operatorData="filteredOperators"
                :guesses="guesses"
                :comparisons="comparisons"
                :targetOperator="targetOperator"
                :gameOver="gameOver"
                :gameWon="gameWon"
                :maxGuesses="maxGuesses"
                :userGaveUp="userGaveUp"
                :potentialMode="potentialMode"
                :trustMode="trustMode"
                :selectedTagGroup="selectedTagGroup"
                @reset="resetGame"
                class="board-component"
              />

              <puzzle-board
                v-else
                :operators="filteredOperators"
                :targetOperator="targetOperator"
                :maxGuesses="maxGuesses"
                :gameOver="gameOver"
                :gameWon="gameWon"
                :userGaveUp="userGaveUp"
                :guesses="guesses"
                :gameSessionId="gameSessionId"
                :puzzleHintInterval="puzzleHintInterval"
                @reset="resetGame"
                class="board-component"
              />
            </template>
          </div>
        </div>
      </main>
    </div>

    <footer class="app-footer">
      <div class="footer-content">
        <p class="footer-text">
          AndyBlocker © 2025
        </p>
      </div>
    </footer>

    <!-- 错误提示组件 -->
    <ErrorToast
      v-for="toast in toastMessages"
      :key="toast.id"
      :message="toast.message"
      :type="toast.type"
      @close="removeToast(toast.id)"
    />

    <!-- 成就通知组件 -->
    <achievement-toast />
  </div>
</template>

<script>
import { ref, onMounted, watch, computed, nextTick } from 'vue';

import GameBoard from './components/GameBoard.vue';
import GuessInput from './components/GuessInput.vue';
import TagSelector from './components/TagSelector.vue';
import PuzzleBoard from './components/PuzzleBoard.vue';
import ChallengeBoard from './components/ChallengeBoard.vue';
import AchievementToast from './components/AchievementToast.vue';

import { loadOperatorsData } from './utils/dataLoader';
import {
  preprocessOperators,
  filterByOnlySixStar,
  selectRandomOperator,
  compareOperators
} from './logic/gameLogic';

import { saveSettings, loadSettings } from './utils/cookieSettings';
import { getCurrentTheme, setTheme } from './themes';
import { createErrorBoundary } from './utils/errorHandler';
import ErrorToast from './components/ErrorToast.vue';
import { InputValidator } from './utils/validator';
import { imagePreloader } from './utils/imagePreloader';
import { getImagePath } from './utils/imageUtils';
import { getAvailableArts } from './logic/puzzleService';

export default {
  name: 'App',
  components: {
    GameBoard,
    GuessInput,
    TagSelector,
    PuzzleBoard,
    ChallengeBoard,
    AchievementToast,
    ErrorToast
  },
  setup() {
    const loading = ref(true);
    const operatorData = ref([]);
    const { error, isError, clearError, handleError } = createErrorBoundary();
    const toastMessages = ref([]);
    const gameSessionId = ref(Date.now().toString()); // 游戏会话ID

    const maxGuesses = ref(6);
    const guesses = ref([]);
    const comparisons = ref([]);
    const targetOperator = ref(null);
    const gameOver = ref(false);
    const gameWon = ref(false);
    const potentialMode = ref('满潜');
    const trustMode = ref('满信赖');
    const userGaveUp = ref(false);
    const onlySixStar = ref(false);
    const puzzleHintInterval = ref(3); // 小头模式提示间隔

    const tagGroups = ref([
      {
        id: 'hard',
        name: '兔头',
        // 在此处新增“上线年份”
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
    ]);
    const selectedTagGroup = ref(tagGroups.value[0]);
    const showAdvanced = ref(false);
    
    // 挑战模式状态
    const isInChallengeMode = ref(false);

    // 主题
    const currentTheme = ref(getCurrentTheme());
    const themeText = computed(() => (currentTheme.value === 'dark' ? '浅色模式' : '深色模式'));

    const filteredOperators = computed(() => {
      if (onlySixStar.value) {
        return filterByOnlySixStar(operatorData.value);
      }
      return operatorData.value;
    });

    const selectTagGroup = (groupId) => {
      const group = tagGroups.value.find((g) => g.id === groupId);
      if (group) {
        selectedTagGroup.value = group;
        resetGame();
        
        // 如果切换到小头模式，启动预加载
        if (groupId === 'puzzle') {
          startPuzzlePreloading();
        }
      }
    };

    // 预加载小头模式图片
    const startPuzzlePreloading = async () => {
      if (filteredOperators.value.length === 0) return;
      
      try {
        console.log('开始预加载小头模式图片...');
        
        // 选择一些高频干员进行预加载（6星干员优先）
        const operatorsToPreload = filteredOperators.value
          .filter(op => op.星级 >= 5) // 5星及以上
          .slice(0, 10); // 限制数量避免过多网络请求
        
        const urlsToPreload = [];
        
        for (const operator of operatorsToPreload) {
          const arts = getAvailableArts(operator);
          // 每个干员预加载1-2张立绘
          const artToPreload = arts.slice(0, 2);
          for (const artFile of artToPreload) {
            urlsToPreload.push(getImagePath(artFile));
          }
        }
        
        // 批量预加载，低优先级避免影响当前游戏
        await imagePreloader.preloadBatch(urlsToPreload, 2);
        console.log(`预加载完成，共加载 ${urlsToPreload.length} 张图片`);
        
      } catch (error) {
        console.warn('预加载失败:', error);
      }
    };

    // 初始化 & 加载数据
    onMounted(async () => {
      initFromCookies();
      await loadData();
    });

    const initFromCookies = () => {
      const settings = loadSettings();
      if (settings) {
        if (typeof settings.onlySixStar === 'boolean') {
          onlySixStar.value = settings.onlySixStar;
        }
        if (typeof settings.maxGuesses === 'number') {
          maxGuesses.value = settings.maxGuesses;
        }
        if (settings.selectedTagGroupId) {
          const group = tagGroups.value.find((g) => g.id === settings.selectedTagGroupId);
          if (group) selectedTagGroup.value = group;
        }
        if (settings.potentialMode) {
          potentialMode.value = settings.potentialMode;
        }
        if (settings.trustMode) {
          trustMode.value = settings.trustMode;
        }
        if (typeof settings.puzzleHintInterval === 'number') {
          puzzleHintInterval.value = settings.puzzleHintInterval;
        }
      }
      // 应用主题
      setTheme(currentTheme.value);
    };

    watch(
      [
        onlySixStar,
        maxGuesses,
        selectedTagGroup,
        potentialMode,
        trustMode,
        currentTheme,
        puzzleHintInterval
      ],
      () => {
        saveToCookies();
      },
      { deep: true }
    );

    const saveToCookies = () => {
      const settings = {
        onlySixStar: onlySixStar.value,
        maxGuesses: maxGuesses.value,
        selectedTagGroupId: selectedTagGroup.value.id,
        potentialMode: potentialMode.value,
        trustMode: trustMode.value,
        puzzleHintInterval: puzzleHintInterval.value
      };
      saveSettings(settings);
      // 主题
      setTheme(currentTheme.value);
    };

    // 监听 onlySixStar 改变，自动重新开局
    watch(onlySixStar, () => {
      resetGame();
    });

    const showToast = (message, type = 'error') => {
      const toast = { id: Date.now(), message, type };
      toastMessages.value.push(toast);
    };

    const removeToast = (id) => {
      const index = toastMessages.value.findIndex(t => t.id === id);
      if (index > -1) {
        toastMessages.value.splice(index, 1);
      }
    };

    // 加载干员数据
    const loadData = async () => {
      try {
        clearError();
        const data = await loadOperatorsData('./data/operators.json');
        preprocessOperators(data);
        operatorData.value = data;
        showToast('干员数据加载成功！', 'success');
      } catch (err) {
        const errorInfo = handleError(err, '加载干员数据');
        showToast(errorInfo.message);
        
        // 尝试加载备用数据或提供重试选项
        if (operatorData.value.length === 0) {
          console.warn('尝试使用空白数据继续运行...');
        }
      } finally {
        loading.value = false;
        if (operatorData.value.length > 0) {
          pickRandomTarget();
        }
      }
    };

    const pickRandomTarget = () => {
      const availableOperators = filteredOperators.value;
      console.log(`选择目标干员，可用干员数量: ${availableOperators.length}`);
      
      if (availableOperators.length === 0) {
        console.warn('没有可用的干员来选择作为目标');
        targetOperator.value = null;
        return;
      }
      
      const newTarget = selectRandomOperator(availableOperators);
      if (newTarget) {
        console.log(`新目标干员已选择: ${newTarget.干员} (${newTarget.星级}星, ${newTarget.职业})`);
        targetOperator.value = newTarget;
      } else {
        console.warn('selectRandomOperator 返回了空值');
        targetOperator.value = null;
      }
    };

    const makeGuess = (operatorName) => {
      // 验证干员名称
      const validation = InputValidator.validateOperatorName(operatorName);
      if (!validation.isValid) {
        showToast(`输入错误: ${validation.errors.join(', ')}`);
        return;
      }

      const sanitizedName = validation.sanitized;
      
      // 增强的干员查找逻辑：支持带/不带特殊字符的匹配
      const guessedOp = filteredOperators.value.find((op) => {
        // 1. 精确匹配
        if (op.干员 === sanitizedName) return true;
        
        // 2. 清理特殊字符后匹配
        const cleanOpName = op.干员.replace(/[·\u00B7\u2022\u2027]/g, '');
        const cleanInputName = sanitizedName.replace(/[·\u00B7\u2022\u2027]/g, '');
        if (cleanOpName === cleanInputName) return true;
        
        return false;
      });
      
      if (!guessedOp) {
        showToast(`未找到干员: ${sanitizedName}`);
        return;
      }

      // puzzle模式
      if (selectedTagGroup.value.id === 'puzzle') {
        guesses.value.push(guessedOp);
        if (guessedOp.干员 === targetOperator.value?.干员) {
          gameWon.value = true;
        }
        if (guesses.value.length >= maxGuesses.value && !gameWon.value) {
          gameOver.value = true;
        }
      } else {
        // 普通模式
        guesses.value.push(guessedOp);
        comparisons.value.push(
          compareOperators(
            guessedOp,
            targetOperator.value,
            selectedTagGroup.value.tags,
            potentialMode.value,
            trustMode.value
          )
        );

        if (guessedOp.干员 === targetOperator.value?.干员) {
          gameWon.value = true;
        }
        if (guesses.value.length >= maxGuesses.value && !gameWon.value) {
          gameOver.value = true;
        }
      }
    };

    const giveUpGame = () => {
      userGaveUp.value = true;
      gameOver.value = true;
    };

    const resetGame = () => {
      console.log('重置游戏开始');
      
      // 先清空目标干员，防止UI显示过期数据
      targetOperator.value = null;
      
      // 重置游戏状态
      guesses.value = [];
      comparisons.value = [];
      gameOver.value = false;
      gameWon.value = false;
      userGaveUp.value = false;
      gameSessionId.value = Date.now().toString(); // 生成新的游戏会话ID
      
      // 等待下一个tick再选择新目标，确保UI已经更新
      nextTick(() => {
        pickRandomTarget();
      });
    };

    // 当潜能或信赖或 maxGuesses 改变，需要重新计算对比结果
    watch([potentialMode, trustMode, maxGuesses], () => {
      if (selectedTagGroup.value.id !== 'puzzle' && guesses.value.length > 0) {
        recalcAllComparisons();
      }
    });

    const recalcAllComparisons = () => {
      comparisons.value = guesses.value.map((guess) =>
        compareOperators(guess, targetOperator.value, selectedTagGroup.value.tags, potentialMode.value, trustMode.value)
      );
      if (guesses.value.length >= maxGuesses.value && !gameWon.value) {
        gameOver.value = true;
      }
    };

    const toggleTheme = () => {
      currentTheme.value = currentTheme.value === 'light' ? 'dark' : 'light';
    };

    // 挑战模式相关方法
    const enterChallengeMode = () => {
      isInChallengeMode.value = true;
    };

    const exitChallengeMode = () => {
      isInChallengeMode.value = false;
    };


    return {
      loading,
      operatorData,
      maxGuesses,
      guesses,
      comparisons,
      targetOperator,
      gameOver,
      gameWon,
      potentialMode,
      trustMode,
      userGaveUp,
      onlySixStar,

      tagGroups,
      selectedTagGroup,
      showAdvanced,

      filteredOperators,
      selectTagGroup,
      makeGuess,
      resetGame,
      giveUpGame,

      currentTheme,
      themeText,
      toggleTheme,

      // 错误处理
      error,
      isError,
      toastMessages,
      showToast,
      removeToast,

      // 游戏会话
      gameSessionId,
      
      // 小头模式设置
      puzzleHintInterval,
      
      // 挑战模式
      isInChallengeMode,
      enterChallengeMode,
      exitChallengeMode
    };
  }
};
</script>

<style>
@import url('./styles/modern-app.css');
</style>
