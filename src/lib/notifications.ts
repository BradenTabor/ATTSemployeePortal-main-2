export const STORAGE_KEYS = {
  LAST_VIEWED_ANNOUNCEMENT: "atts_last_viewed_announcement",
  SIDEBAR_OPEN: "atts_sidebar_open",
};

export const hasNewData = (latestDate: string | null, localKey: string): boolean => {
  if (!latestDate) return false;

  const lastSeen = localStorage.getItem(localKey);
  if (!lastSeen) return true;

  try {
    return new Date(latestDate) > new Date(lastSeen);
  } catch {
    return false;
  }
};

export const hasNewDataWithExpiry = (latestDate: string | null, localKey: string): boolean => {
  if (!latestDate) return false;

  const storedData = localStorage.getItem(localKey);
  if (!storedData) return true;

  try {
    const parsed = JSON.parse(storedData);
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    if (!parsed.date || !parsed.timestamp) {
      return true;
    }

    if (now - parsed.timestamp > sevenDays) {
      return true;
    }

    return new Date(latestDate) > new Date(parsed.date);
  } catch {
    return true;
  }
};

export const setLastViewed = (date: string, localKey: string): void => {
  localStorage.setItem(localKey, date);
};

export const setLastViewedWithTimestamp = (date: string, localKey: string): void => {
  const data = {
    date,
    timestamp: Date.now(),
  };
  localStorage.setItem(localKey, JSON.stringify(data));
};

export const getLastViewed = (localKey: string): string | null => {
  return localStorage.getItem(localKey);
};

export const clearLastViewed = (localKey: string): void => {
  localStorage.removeItem(localKey);
};
