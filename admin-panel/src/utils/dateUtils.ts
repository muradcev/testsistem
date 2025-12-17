/**
 * Tarih yardimci fonksiyonlari - Turkiye saati (Europe/Istanbul) icin
 */

const TURKEY_TIMEZONE = 'Europe/Istanbul';

/**
 * UTC tarihi Turkiye saatine cevirip formatlar
 * @param dateString ISO tarih string'i (UTC)
 * @param options Intl.DateTimeFormat secenekleri
 */
export function formatTurkeyDate(
  dateString: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }
): string {
  if (!dateString) return '-';

  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleString('tr-TR', {
      ...options,
      timeZone: TURKEY_TIMEZONE,
    });
  } catch {
    return '-';
  }
}

/**
 * Sadece tarih formatla (gun/ay/yil)
 */
export function formatTurkeyDateOnly(dateString: string | Date | null | undefined): string {
  return formatTurkeyDate(dateString, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * Sadece saat formatla (saat:dakika)
 */
export function formatTurkeyTimeOnly(dateString: string | Date | null | undefined): string {
  return formatTurkeyDate(dateString, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Tarih ve saat tam formatla (gun/ay/yil saat:dakika:saniye)
 */
export function formatTurkeyDateTime(dateString: string | Date | null | undefined): string {
  return formatTurkeyDate(dateString, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Gecen zaman formatla (X dakika once, X saat once, vs.)
 */
export function formatTimeAgo(dateString: string | Date | null | undefined): string {
  if (!dateString) return '-';

  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Az once';
    if (diffMins < 60) return `${diffMins} dk once`;
    if (diffHours < 24) return `${diffHours} saat once`;
    if (diffDays < 7) return `${diffDays} gun once`;

    return formatTurkeyDateOnly(date);
  } catch {
    return '-';
  }
}

/**
 * Kisa tarih formatla (Bugun, Dun, veya tarih)
 */
export function formatRelativeDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return '-';

  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (dateOnly.getTime() === today.getTime()) {
      return `Bugun ${formatTurkeyTimeOnly(date)}`;
    }
    if (dateOnly.getTime() === yesterday.getTime()) {
      return `Dun ${formatTurkeyTimeOnly(date)}`;
    }

    return formatTurkeyDate(date);
  } catch {
    return '-';
  }
}
