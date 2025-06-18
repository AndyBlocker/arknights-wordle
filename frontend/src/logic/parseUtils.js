// src/logic/parseUtils.js
export function parseBirthdayRaw(birthdayStr) {
    if (typeof birthdayStr !== 'string') return { month: null, day: null };
    const match = birthdayStr.match(/(\d+)月(\d+)日/);
    if (match) {
      return {
        month: parseInt(match[1], 10),
        day: parseInt(match[2], 10)
      };
    }
    return { month: null, day: null };
}
