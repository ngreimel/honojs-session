export type SessionObject = {
  id: string
  data: SessionData
  save: () => Promise<boolean>
  destroy: () => Promise<boolean>
}

export type SessionData = {
  [key: string]: any
}
