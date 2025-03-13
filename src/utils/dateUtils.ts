export const convertUTCToLocal = (utcTimestamp: string) => {
  try {
    // Ensure the timestamp ends with 'Z' if no timezone offset is present
    const isUTC = utcTimestamp.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(utcTimestamp);
    const normalizedTimestamp = isUTC ? utcTimestamp : utcTimestamp + 'Z';

    // Create Date object and validate it
    const utcDate = new Date(normalizedTimestamp);
    if (isNaN(utcDate.getTime())) {
      throw new Error(`Invalid date format: ${utcTimestamp}`);
    }

    // Get user's timezone from localStorage or system settings
    const userTimeZone = localStorage.getItem('userTimezone') || 
      Intl.DateTimeFormat().resolvedOptions().timeZone;

    return new Intl.DateTimeFormat('default', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: userTimeZone
    }).format(utcDate);
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : 'Unknown error');
    return 'Invalid Date';
  }
};

export const convertUTCToLocalTime = (utcTimestamp: string) => {
  try {
    // Check if the timestamp already ends with Z or has timezone offset
    const isUTC = utcTimestamp.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(utcTimestamp);
    
    // Create Date object from UTC string
    const utcDate = new Date(isUTC ? utcTimestamp : utcTimestamp + 'Z');
    
    // Validate the date
    if (isNaN(utcDate.getTime())) {
      console.error('Invalid date:', utcTimestamp);
      return 'Invalid Date';
    }

    const userTimeZone = localStorage.getItem('userTimezone') || 
      Intl.DateTimeFormat().resolvedOptions().timeZone;

    return new Intl.DateTimeFormat('default', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: userTimeZone
    }).format(utcDate);
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : 'Unknown error');
    return 'Invalid Date';
  }
};

// Add a new function that returns a Date object instead of a formatted string
export const getLocalDateFromUTC = (utcTimestamp: string): Date | null => {
  try {
    // Check if the timestamp already ends with Z or has timezone offset
    const isUTC = utcTimestamp.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(utcTimestamp);
    
    // Create Date object from UTC string
    const utcDate = new Date(isUTC ? utcTimestamp : utcTimestamp + 'Z');
    
    // Validate the date
    if (isNaN(utcDate.getTime())) {
      console.error('Invalid date:', utcTimestamp);
      return null;
    }

    return utcDate;
  } catch (error: unknown) {
    console.error('Error converting UTC to local date:', error);
    return null;
  }
};

// Format a date using the user's locale
export const formatDateToLocale = (date: Date | null, format: Intl.DateTimeFormatOptions = {}): string => {
  if (!date) return 'Invalid Date';
  
  try {
    // Get user's locale
    const userLocale = navigator.language || 'en-US';
    
    // Default format options
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
    
    // Merge default options with provided options
    const options = { ...defaultOptions, ...format };
    
    return new Intl.DateTimeFormat(userLocale, options).format(date);
  } catch (error: unknown) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
};

// Format a date in a compact way, with abbreviated year if needed
export const formatCompactDate = (date: Date | null): string => {
  if (!date) return 'Invalid Date';
  
  try {
    // Get current year to decide if we need to show year
    const currentYear = new Date().getFullYear();
    const dateYear = date.getFullYear();
    
    // Get user's locale
    const userLocale = navigator.language || 'en-US';
    
    // Format options without year
    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    };
    
    // Format the date
    const formatter = new Intl.DateTimeFormat(userLocale, options);
    const formattedDate = formatter.format(date);
    
    // If it's not the current year, append abbreviated year
    if (dateYear !== currentYear) {
      const yearStr = dateYear.toString().slice(-2);
      return `${formattedDate} '${yearStr}`;
    }
    
    return formattedDate;
  } catch (error: unknown) {
    console.error('Error formatting compact date:', error);
    return 'Invalid Date';
  }
};