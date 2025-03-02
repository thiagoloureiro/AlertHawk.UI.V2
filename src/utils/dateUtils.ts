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

export const convertUTCToLocalTime = (utcTimestamp: string) => {
  const utcDate = new Date(utcTimestamp + 'Z'); // Ensure it's treated as UTC
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