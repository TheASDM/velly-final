function formatNextSession(iso) {
  if (!iso) return null;
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(date.getTime())) return null;
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  if (endOfDay.getTime() < Date.now()) return null;

  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  let display = `${days[date.getDay()]} ${months[date.getMonth()]} ${date.getDate()}`;
  if (iso.length > 10) {
    let hour = date.getHours();
    const minute = date.getMinutes();
    const meridiem = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    display += ` · ${hour}${minute ? `:${String(minute).padStart(2, "0")}` : ""}${meridiem}`;
  }
  return { iso, display };
}

module.exports = { formatNextSession };
