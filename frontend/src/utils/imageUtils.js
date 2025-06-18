// utils/imageUtils.js
import MD5 from "md5";

export const MEDIA_ENDPOINT = "https://media.prts.wiki";

// 使用 MD5 来构造图片路径
export function getImagePath(filename) {
  const md5 = MD5(filename);
  return `${MEDIA_ENDPOINT}/${md5.slice(0, 1)}/${md5.slice(0, 2)}/${filename}`;
}

/**
 * 获取干员头像文件名
 * 当干员稀有度 >= 3 时，使用 头像_干员名_2.png，否则使用 头像_干员名.png
 */
export function getOperatorAvatarFile(operatorName, rarity) {
  const r = parseInt(rarity, 10);
  if (r >= 3) {
    return `头像_${operatorName}_2.png`;
  } else {
    return `头像_${operatorName}.png`;
  }
}

/**
 * 稀有度图标文件名: 稀有度_黄_x.png
 */
export function getRarityIconFile(rarity) {
  return `稀有度_黄_${rarity}.png`;
}

/**
 * 职业图标文件名: 图标_职业_职业名.png
 */
export function getProfessionIconFile(profession) {
  return `图标_职业_${profession}.png`;
}

/**
 * 给定稀有度返回对应颜色
 */
export function getRarityColor(rarity) {
  const colorMap = {
    "1": "#bfbfbf",
    "2": "#bfbfbf",
    "3": "#00b0ff",
    "4": "#d6c44c",
    "5": "#ffb800",
    "6": "#ff8000"
  };
  return colorMap[rarity] || "#bfbfbf";
}

// 返回立绘列表
export function getOperatorLihuiList(operator) {
  const rarity = parseInt(operator.稀有度, 10) || 0;
  const baseList = [];

  // 精英1一定有
  baseList.push(`立绘_${operator.干员}_1.png`);

  // 如果稀有度 >= 3，可能有精英2
  if (rarity >= 3) {
    baseList.push(`立绘_${operator.干员}_2.png`);
  }

  // 皮肤 1~10
  for (let i = 1; i <= 10; i++) {
    const skinName = operator[`皮肤${i}名称`];
    if (skinName) {
      baseList.push(`立绘_${operator.干员}_skin${i}.png`);
    }
  }

  return baseList;
}
