import Cookies from 'js-cookie';

const THEME_COOKIE_KEY = 'arknightsWordle.theme';

/**
 * 获取当前主题（默认为 'light'）
 */
export function getCurrentTheme() {
  return Cookies.get(THEME_COOKIE_KEY) || 'light';
}

/**
 * 设置并应用主题到文档根节点
 */
export function setTheme(themeName) {
  Cookies.set(THEME_COOKIE_KEY, themeName, { expires: 365 });
  document.documentElement.setAttribute('data-theme', themeName);
}

/**
 * 初始化主题设置
 * 可在 main.js 或 App.vue 中 onMounted 时调用
 */
export function initTheme() {
  const theme = getCurrentTheme();
  document.documentElement.setAttribute('data-theme', theme);
}
