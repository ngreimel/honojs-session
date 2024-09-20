export type SessionObject = {
  id: string
  data: SessionData
  save: () => Promise<boolean>
}

export type SessionData = {
  [key: string]: any
}
