<template>
  <div ref="containerRef" class="guess-input-container">
    <div class="input-wrapper">
      <div class="search-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </div>
      <input
        ref="searchInput"
        type="text"
        v-model="searchTerm"
        @input="onSearchInput"
        @focus="showSuggestions = true"
        @keydown.enter.prevent="submitSelectedOperator"
        @keydown.down="handleDownKey"
        @keydown.up="handleUpKey"
        @keydown.esc="showSuggestions = false"
        placeholder="输入干员名称或拼音..."
        :disabled="disabled"
        class="operator-search-input"
        autocomplete="off"
        role="combobox"
        :aria-expanded="showSuggestions && filteredOperators.length > 0"
        aria-autocomplete="list"
        :aria-activedescendant="activeIndex >= 0 ? `option-${activeIndex}` : null"
        aria-label="搜索干员"
        aria-describedby="search-instructions"
      />
      <button 
        @click="submitSelectedOperator" 
        :disabled="disabled || !canSubmit" 
        class="submit-button"
        aria-label="提交选择的干员"
        :aria-describedby="canSubmit ? 'submit-help' : null"
      >
        提交
      </button>
    </div>

    <!-- 提交按钮帮助信息 -->
    <div v-if="!canSubmit" id="submit-help" class="sr-only">
      请先选择一个干员
    </div>

    <!-- 可访问性说明 -->
    <div id="search-instructions" class="sr-only">
      使用方向键导航选项，回车键选择，ESC键关闭下拉菜单
    </div>

    <div 
      v-if="showSuggestions && filteredOperators.length > 0" 
      class="suggestions-dropdown"
      role="listbox"
      aria-label="干员搜索结果"
    >
      <div
        v-for="(operator, index) in filteredOperators"
        :key="operator.干员"
        :id="`option-${index}`"
        @click="selectOperator(operator)"
        class="suggestion-item"
        :class="{ 'active': index === activeIndex }"
        role="option"
        :aria-selected="index === activeIndex"
        :tabindex="-1"
      >
        <div class="operator-avatar-container">
          <img :src="getOperatorAvatar(operator)" class="operator-avatar" :alt="operator.干员" />
          <div
            class="operator-rarity-badge"
            :style="{ backgroundColor: getRarityColor(operator.稀有度) }"
          >
            {{ operator.星级 }}★
          </div>
        </div>

        <div class="operator-info">
          <span class="operator-name">{{ operator.干员 }}</span>
          <div class="operator-details">
            <span v-if="isChinese(operator.干员)" class="operator-pinyin">{{ getPinyinDisplay(operator) }}</span>
            <span class="operator-profession">{{ operator.职业 }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showSuggestions && searchTerm && filteredOperators.length === 0" class="no-results">
      <span v-if="isGuessedOperator(searchTerm)" class="already-guessed">
        该干员已猜过
      </span>
      <span v-else>
        未找到匹配的干员
      </span>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { getOperatorAvatarFile, getImagePath, getRarityColor } from '../utils/imageUtils';
import { pinyinCache } from '../utils/pinyinCache';
import { InputValidator, debounce } from '../utils/validator';

export default {
  name: 'GuessInput',
  props: {
    operators: {
      type: Array,
      required: true
    },
    disabled: {
      type: Boolean,
      default: false
    },
    guessedOperators: {
      type: Array,
      default: () => []
    }
  },
  emits: ['submit'],
  setup(props, { emit }) {
    const searchInput = ref(null);
    const searchTerm = ref('');
    const selectedOperator = ref(null);
    const showSuggestions = ref(false);
    const activeIndex = ref(0);

    const operatorPinyinMap = ref({});

    const generatePinyinMap = () => {
      operatorPinyinMap.value = pinyinCache.generatePinyinMap(props.operators);
    };

    const isChinese = pinyinCache.isChinese;

    const searchOperators = (term) => {
      if (!term.trim()) return [];
      const searchLower = term.toLowerCase().trim();
      const results = [];

      // 创建已猜测干员名称的Set，用于快速查找
      const guessedNames = new Set(props.guessedOperators.map(op => op.干员 || op));

      props.operators.forEach(op => {
        // 跳过已经猜过的干员
        if (guessedNames.has(op.干员)) {
          return;
        }
        let matched = false;
        let matchScore = 0; // 匹配得分，用于排序
        
        const nameLower = op.干员.toLowerCase();
        // 创建不含特殊字符的版本用于匹配
        const nameClean = op.干员.replace(/[·\u00B7\u2022\u2027]/g, '').toLowerCase();
        
        // 1. 精确匹配优先级最高
        if (nameLower === searchLower || nameClean === searchLower) {
          matched = true;
          matchScore = 1000;
        }
        // 2. 名称开头匹配
        else if (nameLower.startsWith(searchLower) || nameClean.startsWith(searchLower)) {
          matched = true;
          matchScore = 900;
        }
        // 3. 名称包含匹配
        else if (nameLower.includes(searchLower) || nameClean.includes(searchLower)) {
          matched = true;
          matchScore = 800;
        }
        // 4. 拼音匹配（仅对中文干员）
        else if (isChinese(op.干员) && operatorPinyinMap.value[op.干员]) {
          const pinyinData = operatorPinyinMap.value[op.干员];
          
          // 使用增强的拼音匹配功能
          if (pinyinCache.isMatch(searchLower, pinyinData)) {
            matched = true;
            
            // 根据匹配类型给分
            if (pinyinData.full === searchLower || pinyinData.first === searchLower) {
              matchScore = 700; // 完整拼音匹配
            } else if (pinyinData.full.startsWith(searchLower) || pinyinData.first.startsWith(searchLower)) {
              matchScore = 600; // 拼音前缀匹配
            } else if (pinyinData.variants.full.some(v => v === searchLower) || 
                      pinyinData.variants.first.some(v => v === searchLower)) {
              matchScore = 550; // 多音字精确匹配
            } else if (pinyinData.variants.full.some(v => v.startsWith(searchLower)) || 
                      pinyinData.variants.first.some(v => v.startsWith(searchLower))) {
              matchScore = 500; // 多音字前缀匹配
            } else {
              matchScore = 400; // 其他拼音匹配（包含匹配、部分匹配等）
            }
          }
        }
        
        if (matched) {
          results.push({ operator: op, score: matchScore });
        }
      });

      // 按匹配得分排序，得分相同时按名称长度排序
      return results
        .sort((a, b) => {
          if (a.score !== b.score) {
            return b.score - a.score; // 得分高的在前
          }
          return a.operator.干员.length - b.operator.干员.length; // 名称短的在前
        })
        .map(item => item.operator);
    };

    const searchResults = ref([]);
    const searchDebounceTimer = ref(null);

    const debouncedSearch = (term) => {
      if (searchDebounceTimer.value) {
        clearTimeout(searchDebounceTimer.value);
      }
      
      searchDebounceTimer.value = setTimeout(() => {
        if (!term.trim()) {
          searchResults.value = [];
          activeIndex.value = 0;
          return;
        }
        searchResults.value = searchOperators(term).slice(0, 8);
        // 重置activeIndex到第一个选项
        activeIndex.value = searchResults.value.length > 0 ? 0 : 0;
      }, 150); // 150ms防抖
    };

    const filteredOperators = computed(() => searchResults.value);

    const canSubmit = computed(() => {
      return selectedOperator.value || filteredOperators.value.length === 1;
    });

    const onSearchInput = () => {
      // 轻量级验证：只检查长度，允许用户自由输入
      if (searchTerm.value && searchTerm.value.length > 30) {
        searchTerm.value = searchTerm.value.substring(0, 30);
      }
      
      selectedOperator.value = null;
      showSuggestions.value = true;
      
      // 如果搜索词为空，立即清空结果和重置索引
      if (!searchTerm.value.trim()) {
        searchResults.value = [];
        activeIndex.value = 0;
        return;
      }
      
      // 对于即时搜索（短查询），直接搜索以提高响应性
      if (searchTerm.value.length <= 2) {
        searchResults.value = searchOperators(searchTerm.value).slice(0, 8);
        activeIndex.value = 0;
      } else {
        // 长查询使用防抖
        debouncedSearch(searchTerm.value);
      }
    };

    const selectOperator = (operator) => {
      selectedOperator.value = operator;
      searchTerm.value = operator.干员;
      showSuggestions.value = false;
    };

    const submitSelectedOperator = () => {
      const operators = filteredOperators.value;
      
      if (!selectedOperator.value && operators.length === 1) {
        selectOperator(operators[0]);
      } else if (!selectedOperator.value && operators.length > 1) {
        // 确保activeIndex在有效范围内
        const safeIndex = Math.max(0, Math.min(activeIndex.value, operators.length - 1));
        if (operators[safeIndex]) {
          selectOperator(operators[safeIndex]);
        }
      }
      
      if (selectedOperator.value) {
        // 简单的名称检查，信任用户选择的干员
        const operatorName = selectedOperator.value.干员;
        if (operatorName && operatorName.trim()) {
          emit('submit', operatorName.trim());
          searchTerm.value = '';
          selectedOperator.value = null;
          activeIndex.value = 0;
          setTimeout(() => {
            searchInput.value?.focus();
          }, 100);
        }
      }
    };

    const navigateSuggestion = (direction) => {
      const operators = filteredOperators.value;
      if (operators.length === 0) {
        activeIndex.value = 0;
        return;
      }
      
      // 确保activeIndex在有效范围内
      if (activeIndex.value < 0 || activeIndex.value >= operators.length) {
        activeIndex.value = 0;
      }
      
      let newIndex = activeIndex.value + direction;
      
      // 循环导航
      if (newIndex < 0) {
        newIndex = operators.length - 1;
      } else if (newIndex >= operators.length) {
        newIndex = 0;
      }
      
      activeIndex.value = newIndex;
      
      // 确保选中的项目在视野内
      scrollActiveItemIntoView();
    };

    const handleDownKey = (event) => {
      // 只有在显示建议且有结果时才拦截方向键
      if (showSuggestions.value && filteredOperators.value.length > 0) {
        event.preventDefault();
        navigateSuggestion(1);
      }
      // 否则允许默认行为（正常的光标移动等）
    };

    const handleUpKey = (event) => {
      // 只有在显示建议且有结果时才拦截方向键
      if (showSuggestions.value && filteredOperators.value.length > 0) {
        event.preventDefault();
        navigateSuggestion(-1);
      }
      // 否则允许默认行为（正常的光标移动等）
    };

    const scrollActiveItemIntoView = () => {
      // 滚动活动项目到视野内
      nextTick(() => {
        const activeElement = document.getElementById(`option-${activeIndex.value}`);
        if (activeElement) {
          activeElement.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
          });
        }
      });
    };

    const getOperatorAvatar = (operator) => {
      const file = getOperatorAvatarFile(operator.干员, operator.稀有度);
      return getImagePath(file);
    };

    const getPinyinDisplay = (operator) => {
      if (!isChinese(operator.干员)) return '';
      const data = operatorPinyinMap.value[operator.干员];
      if (!data) return '';
      
      // 优先显示全拼音，如果太长则显示首字母
      const full = data.full || '';
      const first = data.first || '';
      
      // 如果全拼音长度适中，显示全拼音
      if (full.length <= 12) {
        return full;
      }
      
      // 如果全拼音太长，显示首字母（如果有的话）
      if (first && first.length <= 8) {
        return first;
      }
      
      // 作为后备，截断显示全拼音
      return full.length > 15 ? full.substring(0, 12) + '...' : full;
    };

    const isGuessedOperator = (operatorName) => {
      const guessedNames = new Set(props.guessedOperators.map(op => op.干员 || op));
      return guessedNames.has(operatorName.trim());
    };

    const containerRef = ref(null);
    const clickOutsideHandler = ref(null);

    const handleClickOutside = (event) => {
      if (containerRef.value && !containerRef.value.contains(event.target)) {
        showSuggestions.value = false;
      }
    };

    const attachClickOutsideListener = () => {
      if (!clickOutsideHandler.value) {
        clickOutsideHandler.value = handleClickOutside;
        setTimeout(() => {
          document.addEventListener('click', clickOutsideHandler.value, { passive: true });
        }, 0);
      }
    };

    const removeClickOutsideListener = () => {
      if (clickOutsideHandler.value) {
        document.removeEventListener('click', clickOutsideHandler.value);
        clickOutsideHandler.value = null;
      }
    };

    watch(showSuggestions, val => {
      if (val) {
        attachClickOutsideListener();
      } else {
        removeClickOutsideListener();
      }
    });

    // 监听operators变化，重新生成拼音映射
    watch(() => props.operators, (newOperators) => {
      if (newOperators && newOperators.length > 0) {
        console.log('GuessInput: 重新生成拼音映射，干员数量:', newOperators.length);
        generatePinyinMap();
      }
    }, { immediate: true });

    onMounted(() => {
      generatePinyinMap();
      searchInput.value?.focus();
    });

    onBeforeUnmount(() => {
      removeClickOutsideListener();
      if (searchDebounceTimer.value) {
        clearTimeout(searchDebounceTimer.value);
      }
    });

    return {
      containerRef,
      searchInput,
      searchTerm,
      selectedOperator,
      showSuggestions,
      activeIndex,
      canSubmit,
      filteredOperators,
      onSearchInput,
      selectOperator,
      submitSelectedOperator,
      navigateSuggestion,
      handleDownKey,
      handleUpKey,
      getOperatorAvatar,
      getRarityColor,
      getPinyinDisplay,
      isChinese,
      isGuessedOperator
    };
  }
};
</script>

<style>
.guess-input-container {
  position: relative;
  width: 75%;
  z-index: 99999;
  margin: 0 auto;
}

/* 可访问性：屏幕阅读器专用内容 */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.input-wrapper {
  display: flex;
  position: relative;
  align-items: stretch;
  border-radius: 8px;
  background-color: var(--color-card-bg);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #8c9db5;
  display: flex;
  align-items: center;
  z-index: 1;
}

.operator-search-input {
  flex: 1;
  padding: 12px 12px 12px 40px;
  font-size: 16px;
  border: 1px solid var(--color-border);
  border-right: none;
  border-radius: 0;
  transition: all var(--transition-duration);
  background-color: transparent;
  color: var(--color-text);
  height: 44px;
  box-sizing: border-box;
}

.operator-search-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.operator-search-input:focus-visible {
  outline: none;
}

.operator-search-input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
  color: #999;
}

.submit-button {
  padding: 0 20px;
  height: 44px;
  background-color: var(--color-primary);
  color: white;
  border: 1px solid var(--color-primary);
  border-radius: 0;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--transition-duration);
  white-space: nowrap;
  flex-shrink: 0;
  min-width: 60px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  line-height: 1;
}
.submit-button:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
}

.submit-button:focus {
  outline: none;
}

.submit-button:focus-visible {
  outline: none;
}

.submit-button:disabled {
  background-color: #bdc3c7;
  cursor: not-allowed;
}

/* 下拉菜单 */
.suggestions-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 8px;
  background-color: var(--color-card-bg);
  border-radius: 8px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  z-index: 999999;
  max-height: 350px;
  overflow-y: auto;
  backdrop-filter: blur(20px);
  border: 2px solid var(--color-primary);
}

.suggestion-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: 1px solid var(--color-border);
}
.suggestion-item:hover,
.suggestion-item.active,
.suggestion-item:focus {
  background-color: rgba(255,255,255,0.1);
  outline: none;
}

.suggestion-item:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}
.suggestion-item:last-child {
  border-bottom: none;
}

.operator-avatar-container {
  width: 48px;
  height: 48px;
  margin-right: 16px;
  border-radius: 50%;
  overflow: hidden;
  background-color: #f0f0f0;
  position: relative;
}

.operator-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.operator-rarity-badge {
  position: absolute;
  bottom: -2px;
  right: -2px;
  border-radius: 10px;
  padding: 1px 5px;
  font-size: 10px;
  font-weight: bold;
  color: white;
  background-color: #ffb800;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.operator-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.operator-name {
  font-weight: 600;
  font-size: 16px;
  margin-bottom: 2px;
  color: var(--color-text);
}

.operator-details {
  display: flex;
  font-size: 12px;
  color: #888;
  gap: 8px;
}

.operator-profession {
  background-color: #eef2f7;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.operator-pinyin {
  color: #8c9db5;
  font-style: italic;
}

/* 无结果提示 */
.no-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 8px;
  padding: 16px;
  background-color: var(--color-card-bg);
  border-radius: 8px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
  text-align: center;
  color: #888;
  z-index: 999999;
  backdrop-filter: blur(20px);
  border: 2px solid var(--color-primary);
}

.already-guessed {
  color: #ff9800;
  font-weight: 500;
}

/* 响应式 */
@media (max-width: 768px) {
  .operator-search-input {
    font-size: 14px;
    padding: 10px 10px 10px 36px;
    height: 40px;
  }
  .submit-button {
    font-size: 14px;
    padding: 0 16px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    line-height: 1;
  }
  .search-icon {
    left: 10px;
  }
  .operator-avatar-container {
    width: 36px;
    height: 36px;
    margin-right: 10px;
  }
  .suggestion-item {
    padding: 8px 12px;
  }
  .operator-name {
    font-size: 14px;
  }
}
</style>
