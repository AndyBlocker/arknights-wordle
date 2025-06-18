import Cookies from 'js-cookie';

const SETTINGS_COOKIE_KEY = 'arknightsWordle.settings';

export function saveSettings(settings) {
  try {
    Cookies.set(SETTINGS_COOKIE_KEY, JSON.stringify(settings), { expires: 365 });
  } catch (error) {
    console.error('保存游戏设置到Cookie失败:', error);
  }
}

export function loadSettings() {
  try {
    const raw = Cookies.get(SETTINGS_COOKIE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (error) {
    console.error('从Cookie加载游戏设置失败:', error);
  }
  return {};
}
