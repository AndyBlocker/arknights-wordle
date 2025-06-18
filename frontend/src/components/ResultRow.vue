<template>
  <div class="result-row" :class="{ 'answer-row': isAnswerRow }">
    <div class="result-cell cell-avatar">
      <div class="avatar-container">
        <img :src="getOperatorAvatar(guess)" class="operator-avatar" :alt="guess.干员" />
      </div>
      <div class="operator-name desktop-only">{{ guess.干员 }}</div>
    </div>

    <template v-for="tag in displayTags" :key="tag">
      <!-- 标签字段 -->
      <div
        v-if="tag === '标签'"
        class="result-cell tag-cell"
        :class="getTagCellClass(comparison[tag])"
      >
        <div class="tags-container">
          <span
            v-for="gTag in comparison[tag].guessTags"
            :key="gTag"
            :class="{ 'tag-match': comparison[tag].correctTags.includes(gTag) }"
          >
            {{ gTag }}
          </span>
        </div>
      </div>

      <!-- 出生日期：部分匹配/或简单true -->
      <div
        v-else-if="isBirthdayComparison(comparison[tag])"
        class="result-cell tag-cell"
        :class="getTagCellClass(comparison[tag])"
      >
        <div class="tags-container">
          <span
            v-for="token in comparison[tag].guessTokens"
            :key="token"
            :class="{ 'tag-match': comparison[tag].correctTokens.includes(token) }"
          >
            {{ token }}
          </span>
        </div>
      </div>
      <div
        v-else-if="tag === '出生日期'"
        class="result-cell"
        :class="getCellClass(comparison[tag])"
      >
        {{ guess[tag] }}
      </div>

      <!-- 数值型字段 -->
      <div
        v-else-if="isNumericTag(tag)"
        class="result-cell"
        :class="getNumericCellClass(comparison[tag])"
      >
        <div class="cell-content">
          <template v-if="comparison[tag] === true">
            {{ guess[tag] }}
          </template>
          <template v-else-if="typeof comparison[tag] === 'object' && comparison[tag] !== null">
            {{ comparison[tag].guessedValue }}
            <span
              v-if="!comparison[tag].match"
              class="direction-indicator"
              :class="{
                'higher-arrow': comparison[tag].direction === 'higher',
                'lower-arrow': comparison[tag].direction === 'lower'
              }"
            >
              {{ comparison[tag].direction === 'higher' ? '↑' : '↓' }}
            </span>
          </template>
        </div>
      </div>

      <!-- 普通字符串 -->
      <div
        v-else
        class="result-cell"
        :class="getCellClass(comparison[tag])"
      >
        <template v-if="comparison[tag] === true">
          {{ guess[tag] }}
        </template>
        <template v-else-if="typeof comparison[tag] === 'boolean'">
          {{ guess[tag] }}
        </template>
        <template v-else>
          {{ guess[tag] }}
        </template>
      </div>
    </template>
  </div>
</template>

<script>
import { getImagePath, getOperatorAvatarFile } from '../utils/imageUtils';

export default {
  name: 'ResultRow',
  props: {
    guess: {
      type: Object,
      required: true
    },
    comparison: {
      type: Object,
      required: true
    },
    displayTags: {
      type: Array,
      required: true
    },
    isAnswerRow: {
      type: Boolean,
      default: false
    }
  },
  setup() {
    /**
     * 判断是否为数值类字段
     */
    const isNumericTag = (tag) => [
      '星级',
      '满级攻击',
      '满级生命',
      '满级防御',
      '满级法术抗性',
      '部署费用',
      '阻挡数',
      '攻击间隔',
      '身高',
      '上线年份'
    ].includes(tag);

    /**
     * 判断是否为出生日期对比对象
     */
    const isBirthdayComparison = (val) => {
      return val && typeof val === 'object' && val.isBirthday;
    };

    /**
     * 普通字段 / 出生日期为 false 时 => incorrect
     * true 时 => correct
     */
    const getCellClass = (res) => {
      if (res === true) return 'correct';
      if (res === false) return 'incorrect';
      return 'incorrect';
    };

    /**
     * 数值型字段，需要判断是完全相等、接近远离、方向等
     */
    const getNumericCellClass = (res) => {
      if (res === true) {
        // 直接命中
        return 'correct';
      }
      if (res && res.match) {
        // 数值相同
        return 'correct';
      }
      if (res && res.direction) {
        // 有方向 => higher/lower; differenceType => close/far
        const { direction, differenceType } = res;
        return `${direction}-${differenceType}`;
      }
      // 其他情况 => incorrect
      return 'incorrect';
    };

    /**
     * 标签字段，若有至少一个重叠 => correct，否则 => incorrect
     */
    const getTagCellClass = (tagComparison) => {
      if (!tagComparison) return 'incorrect';
      if (tagComparison.correctTags && tagComparison.correctTags.length > 0) {
        return 'correct';
      }
      return 'incorrect';
    };

    /**
     * 获取干员头像
     */
    const getOperatorAvatar = (operator) => {
      const filename = getOperatorAvatarFile(operator.干员, operator.稀有度);
      return getImagePath(filename);
    };

    return {
      isNumericTag,
      isBirthdayComparison,
      getCellClass,
      getNumericCellClass,
      getTagCellClass,
      getOperatorAvatar
    };
  }
};
</script>

<style>
.result-row {
  display: table-row;
  width: 100%;
  border-bottom: 1px solid var(--color-border);
  transition: background-color var(--transition-duration);
}

.result-row:last-child {
  border-bottom: none;
}

/* 当此行是正确答案时 */
.answer-row {
  font-weight: 600;
  background-color: rgba(63, 81, 181, 0.08);
}

.result-cell {
  display: table-cell;
  padding: 12px;
  text-align: center;
  vertical-align: middle;
  border-right: 1px solid var(--color-border);
  position: relative;
  font-weight: 500;
  color: var(--color-text);
}
.result-cell:last-child {
  border-right: none;
}

/* 第一列：干员头像 */
.cell-avatar {
  width: 100px;
  background-color: rgba(0,0,0,0.02);
}

.avatar-container {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  overflow: hidden;
  margin-bottom: 6px;
  background-color: #eee;
  border: 2px solid #ddd;
  margin: auto;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.operator-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.operator-name {
  font-size: 14px;
  margin-top: 4px;
  color: var(--color-text);
}

/* 数值比对图标/方向 */
.cell-content {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.direction-indicator {
  margin-left: 3px;
  font-weight: bold;
}

/* 配色方案：改为浅橙、浅红等 */
.correct {
  background-color: rgba(76, 175, 80, 0.2); /* 浅绿色 */
}
.incorrect {
  background-color: rgba(244, 67, 54, 0.2); /* 浅红色 */
}

/* 数值差距为 close => 浅橙色, far => 更红一些 */
.higher-close,
.lower-close {
  background-color: rgba(255, 152, 0, 0.2); /* 浅橙 */
}
.higher-far,
.lower-far {
  background-color: rgba(244, 67, 54, 0.3); /* 浅红(稍深) */
}

/* 箭头颜色：橙色/红色 */
.higher-arrow {
  color: #ff9800;
}
.lower-arrow {
  color: #f44336;
}

/* 标签 / 生日 */
.tag-cell .tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: center;
}
.tag-cell span {
  padding: 2px 6px;
  border-radius: 4px;
  background: #fafafa;
  font-size: 12px;
}
.tag-cell .tag-match {
  background: rgba(76, 175, 80, 0.3);
  font-weight: bold;
}

/* 桌面端额外显示干员名称 */
.desktop-only {
  display: block;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .result-cell {
    padding: 8px;
    font-size: 12px;
  }
  .cell-avatar {
    width: 60px;
  }
  .avatar-container {
    width: 36px;
    height: 36px;
  }
  .operator-name {
    display: none;
  }
}
</style>
