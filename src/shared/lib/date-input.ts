/** `YYYY-MM-DD` for `<input type="date">`, using the local calendar day. */
export function todayDateInputValue(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** `YYYY-MM-DDTHH:mm` for `<input type="datetime-local">`, using local time. */
export function nowDatetimeLocalValue(date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${todayDateInputValue(date)}T${hours}:${minutes}`
}
