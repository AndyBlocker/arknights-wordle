// src/logic/gameLogic.js
import { parseBirthdayRaw } from './parseUtils.js'; 

function numericValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(value.trim())) return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function isUnknown(value) {
  return value == null || (typeof value === 'string' && ['', '未知', '不明', '不详', '未公开', '?', '？', '/', '-'].includes(value.trim()));
}

function unknownComparison(guessedValue, targetValue) {
  return { unknown: true, match: false, guessedValue: isUnknown(guessedValue) ? null : guessedValue, targetValue: isUnknown(targetValue) ? null : targetValue };
}

export function parseBirthday(birthdayStr) {
  return parseBirthdayRaw(birthdayStr);
}

/**
 * 预处理数据
 */
export function preprocessOperators(data) {
  data.forEach(op => {
    // 稀有度 => 星级
    if (op.稀有度 !== undefined) {
      const rarityNum = parseInt(op.稀有度, 10) || 0;
      op.星级 = rarityNum + 1;
    }
    // 攻击速度 => 攻击间隔
    if (op.攻击速度) {
      const match = op.攻击速度.match(/([\d.]+)/);
      const interval = match ? parseFloat(match[1]) : null;
      op.攻击间隔 = interval;
      delete op.攻击速度;
    }
    // 身高
    const heightNum = numericValue(typeof op.身高 === 'string' ? op.身高.replace(/\s*cm$/i, '').trim() : op.身高);
    op.身高 = heightNum != null && heightNum > 0 ? heightNum : null;

    // 解析潜能加成
    op.__parsedPotential = {};
    if (op.潜能加成 && op.潜能加成.includes('`')) {
      const [keysStr, valsStr] = op.潜能加成.split('`');
      const keyList = keysStr.split(',').map(s => s.trim());
      const valList = valsStr.split(',').map(s => s.trim());
      const potentialMap = {
        atk: '满级攻击',
        hp: '满级生命',
        def: '满级防御',
        res: '满级法术抗性'
      };
      keyList.forEach((k, idx) => {
        const v = numericValue(valList[idx]) ?? 0;
        const mappedField = potentialMap[k];
        if (mappedField) {
          op.__parsedPotential[mappedField] = (op.__parsedPotential[mappedField] || 0) + v;
        }
      });
    }

    // 解析信赖加成
    op.__parsedTrust = {};
    if (op.信赖加成) {
      const trustVals = op.信赖加成.split(',').map(s => numericValue(s.trim()) ?? 0);
      // [满级生命, 满级攻击, 满级防御]
      op.__parsedTrust['满级生命'] = trustVals[0] || 0;
      op.__parsedTrust['满级攻击'] = trustVals[1] || 0;
      op.__parsedTrust['满级防御'] = trustVals[2] || 0;
    }

    // 解析上线年份，只取年份
    if (op.上线时间) {
      const dateObj = new Date(op.上线时间);
      if (!isNaN(dateObj)) {
        op.上线年份 = dateObj.getFullYear();
      }
    }
  });
}

/**
 * 从一批干员中随机选择1位
 */
export function selectRandomOperator(operators) {
  if (!operators || !operators.length) return null;
  const idx = Math.floor(Math.random() * operators.length);
  return operators[idx];
}

/**
 * 根据 onlySixStar 筛选
 */
export function filterByOnlySixStar(operators) {
  return operators.filter(op => op.星级 === 6);
}

/**
 * 获取干员数值在潜能/信赖影响下的有效值
 */
export function getEffectiveValue(op, tag, potentialMode, trustMode) {
  const baseVal = numericValue(op[tag]);
  if (baseVal == null) return null;
  let total = baseVal;
  // 满潜
  if (potentialMode === '满潜') {
    total += op.__parsedPotential?.[tag] || 0;
  }
  // 满信赖
  if (trustMode === '满信赖') {
    total += op.__parsedTrust?.[tag] || 0;
  }
  return total;
}

/**
 * 对比 guessed 和 target 干员在指定 tags 下的数据
 */
export function compareOperators(guessed, target, tags, potentialMode, trustMode) {
  const comparison = {};
  if (!target) return comparison;

  tags.forEach(tag => {
    if (tag === '标签') {
      const guessTags = guessed[tag]?.split(' ').map(s => s.trim()).filter(Boolean) || [];
      const targetTags = target[tag]?.split(' ').map(s => s.trim()).filter(Boolean) || [];
      const correctTags = guessTags.filter(g => targetTags.includes(g));
      comparison[tag] = guessTags.length && targetTags.length
        ? { guessTags, targetTags, correctTags }
        : { ...unknownComparison(guessed[tag], target[tag]), guessTags, targetTags, correctTags };
    }
    else if (tag === '出生日期') {
      comparison[tag] = compareBirthdays(guessed[tag], target[tag]);
    }
    else if ([
      '满级攻击', '满级生命', '满级防御', '满级法术抗性',
      '星级', '攻击间隔', '身高', '稀有度', '部署费用', '阻挡数', '上线年份'
    ].includes(tag)) {
      const gVal = getEffectiveValue(guessed, tag, potentialMode, trustMode);
      const tVal = getEffectiveValue(target, tag, potentialMode, trustMode);
      if (gVal == null || tVal == null) {
        comparison[tag] = unknownComparison(gVal, tVal);
      } else if (gVal === tVal) {
        comparison[tag] = {
          match: true,
          guessedValue: gVal,
          targetValue: tVal
        };
      } else {
        const direction = gVal < tVal ? 'higher' : 'lower';
        const diff = Math.abs(gVal - tVal);
        let differenceType = 'far';
        if (tVal < 10) {
          if (diff <= 1) differenceType = 'close';
        } else {
          if (diff <= tVal * 0.1) differenceType = 'close';
        }
        comparison[tag] = {
          match: false,
          direction,
          differenceType,
          guessedValue: gVal,
          targetValue: tVal
        };
      }
    }
    else {
      // 普通字段
      comparison[tag] = isUnknown(guessed[tag]) || isUnknown(target[tag])
        ? unknownComparison(guessed[tag], target[tag])
        : guessed[tag] === target[tag];
    }
  });

  return comparison;
}

/**
 * 比较出生日期：可能存在部分月/日匹配
 */
function compareBirthdays(guessBD, targetBD) {
  if (isUnknown(guessBD) || isUnknown(targetBD)) return unknownComparison(guessBD, targetBD);
  const pattern = /^(\d+)月(\d+)日$/;
  const gMatch = guessBD.match(pattern);
  const tMatch = targetBD.match(pattern);
  if (gMatch && tMatch) {
    const guessTokens = [`${gMatch[1]}月`, `${gMatch[2]}日`];
    const targetTokens = [`${tMatch[1]}月`, `${tMatch[2]}日`];
    const correctTokens = guessTokens.filter(g => targetTokens.includes(g));
    return {
      isBirthday: true,
      match: guessTokens.every((token, index) => token === targetTokens[index]),
      guessTokens,
      targetTokens,
      correctTokens
    };
  } else {
    return guessBD === targetBD;
  }
}
