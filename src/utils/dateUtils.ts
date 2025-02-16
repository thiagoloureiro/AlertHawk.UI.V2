export const convertUTCToLocal = (utcTimestamp: string) => {
  // Create Date object from UTC string and explicitly handle as UTC
  const utcDate = new Date(utcTimestamp + 'Z'); // Append 'Z' to ensure UTC interpretation
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
};

// Optional: If you need just the time part separately
export const convertUTCToLocalTime = (utcTimestamp: string) => {
  const utcDate = new Date(utcTimestamp + 'Z');
  const userTimeZone = localStorage.getItem('userTimezone') || 
    Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  return new Intl.DateTimeFormat('default', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: userTimeZone
  }).format(utcDate);
}; 