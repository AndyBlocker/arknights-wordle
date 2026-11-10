<template>
  <div class="game-board">
    <div class="game-status">
      <template v-if="gameWon">
        <div class="status-message win">
          <span>恭喜你猜对了！答案是 {{ targetOperator?.干员 }}</span>
        </div>
      </template>
      <template v-else-if="userGaveUp">
        <div class="status-message lose">
          <span>你已放弃游戏！正确答案是 {{ targetOperator?.干员 }}</span>
        </div>
      </template>
      <template v-else-if="gameOver && !userGaveUp">
        <div class="status-message lose">
          <span>游戏结束！正确答案是 {{ targetOperator?.干员 }}</span>
        </div>
      </template>
      <template v-else>
        <div class="attempts-counter">
          已猜次数: {{ guesses.length }} / {{ maxGuesses }}
        </div>
      </template>
    </div>

    <div class="results-section" tabindex="0" role="region" aria-label="猜测结果，可横向滚动查看全部属性">
      <div class="results-table" role="table" aria-label="猜测结果">
        <div class="header-row" role="row">
          <div class="header-cell cell-avatar" role="columnheader">干员</div>
          <div
            v-for="tag in displayTags"
            :key="tag"
            class="header-cell"
            role="columnheader"
          >
            {{ tag }}
          </div>
        </div>

        <div class="results-body" role="rowgroup">
          <result-row
            v-for="(guess, index) in guesses"
            :key="index"
            :guess="guess"
            :comparison="comparisons[index]"
            :displayTags="displayTags"
          />

          <!-- 若用尽次数/放弃且没猜中 => 显示答案行 -->
          <result-row
            v-if="targetOperator && ((gameOver && !gameWon) || userGaveUp)"
            :guess="targetOperator"
            :comparison="answerComparison"
            :displayTags="displayTags"
            :isAnswerRow="true"
          />
        </div>
      </div>
    </div>

    <div class="game-controls">
      <button
        v-if="!isChallenge && (gameOver || gameWon)"
        @click="handleReset"
        class="reset-button"
      >
        重新开始
      </button>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';
import ResultRow from './ResultRow.vue';
import { compareOperators } from '../logic/gameLogic';

export default {
  name: 'GameBoard',
  components: {
    ResultRow
  },
  props: {
    isChallenge: {
      type: Boolean,
      default: false
    },
    operatorData: {
      type: Array,
      required: true
    },
    guesses: {
      type: Array,
      required: true
    },
    comparisons: {
      type: Array,
      required: true
    },
    targetOperator: {
      type: Object,
      required: true
    },
    gameOver: {
      type: Boolean,
      required: true
    },
    gameWon: {
      type: Boolean,
      required: true
    },
    maxGuesses: {
      type: Number,
      required: true
    },
    userGaveUp: {
      type: Boolean,
      default: false
    },
    potentialMode: {
      type: String,
      default: '0潜'
    },
    trustMode: {
      type: String,
      default: '0信赖'
    },
    selectedTagGroup: {
      type: Object,
      required: false
    }
  },
  emits: ['reset'],
  setup(props, { emit }) {
    const displayTags = computed(() => {
      if (!props.selectedTagGroup) return [];
      return props.selectedTagGroup.tags || [];
    });

    const handleReset = () => {
      emit('reset');
    };

    // 答案行的对比对象
    const answerComparison = computed(() => {
      return compareAsAnswer(props.targetOperator, displayTags.value, props.potentialMode, props.trustMode);
    });

    function compareAsAnswer(op, tags, potentialMode, trustMode) {
      return op ? compareOperators(op, op, tags, potentialMode, trustMode) : {};
    }

    return {
      displayTags,
      answerComparison,
      handleReset
    };
  }
};
</script>

<style>
.game-board {
  display: flex;
  flex-direction: column;
  gap: 20px;
  transition: background-color var(--transition-duration);
}

.game-status {
  text-align: center;
  margin-bottom: 10px;
}

.status-message {
  padding: 12px;
  border-radius: 6px;
  font-weight: bold;
  font-size: 18px;
  word-wrap: break-word;
  white-space: normal;
  margin: 0 auto;
  max-width: 600px;
}

.win {
  background-color: var(--color-win-bg);
  color: var(--color-win-text);
}

.lose {
  background-color: var(--color-lose-bg);
  color: var(--color-lose-text);
}

.attempts-counter {
  font-size: 18px;
  color: var(--color-text);
  font-weight: 500;
}

.results-section {
  margin-top: 15px;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow-x: auto;
  background-color: var(--color-card-bg);
  padding: 8px;
}

.results-table {
  display: table;
  width: 100%;
  table-layout: auto;
  border-collapse: separate;
  border-spacing: 0 2px;
}

.header-row {
  display: table-row;
  background-color: rgba(255, 255, 255, 0.1);
}

.header-cell {
  display: table-cell;
  padding: 12px;
  text-align: center;
  font-weight: 600;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
}
.cell-avatar {
  width: 100px;
}

.results-body {
  display: table-row-group;
}

.game-controls {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}

.reset-button {
  padding: 10px 24px;
  font-size: 16px;
  font-weight: 500;
  background-color: var(--color-primary);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color var(--transition-duration);
}
.reset-button:hover {
  background-color: var(--color-primary-hover);
}

@media (max-width: 768px) {
  .attempts-counter {
    font-size: 16px;
  }
  .status-message {
    font-size: 16px;
    padding: 8px;
  }
  .header-cell {
    font-size: 13px;
    padding: 8px;
  }
  .cell-avatar {
    width: 60px;
  }
}
</style>
