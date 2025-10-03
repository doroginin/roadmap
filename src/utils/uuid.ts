// Утилиты для работы с UUID
export function generateUUID(): string {
  // Используем crypto.randomUUID() если доступен, иначе fallback на правильную генерацию UUID v4
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback: правильная генерация UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function getOrCreateUserID(): string {
  const STORAGE_KEY = 'roadmap_user_id';
  
  // Пытаемся получить существующий ID из localStorage
  let userId = localStorage.getItem(STORAGE_KEY);
  
  // Если ID не существует, создаем новый
  if (!userId) {
    userId = generateUUID();
    localStorage.setItem(STORAGE_KEY, userId);
  }
  
  return userId;
}

