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
  } catch (error) {
    console.error(error.message);
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
  } catch (error) {
    console.error(error.message);
    return 'Invalid Date';
  }
};