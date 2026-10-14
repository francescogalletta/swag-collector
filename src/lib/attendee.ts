const ID_KEY = 'swag:attendee_id'
const NAME_KEY = 'swag:attendee_name'

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  // Fallback for very old browsers.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function getAttendeeId(): string {
  try {
    const existing = localStorage.getItem(ID_KEY)
    if (existing) return existing
    const fresh = uuid()
    localStorage.setItem(ID_KEY, fresh)
    return fresh
  } catch {
    return uuid()
  }
}

export function getAttendeeName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setAttendeeName(name: string) {
  try {
    if (name.trim()) localStorage.setItem(NAME_KEY, name.trim())
    else localStorage.removeItem(NAME_KEY)
  } catch {
    /* ignore */
  }
}
