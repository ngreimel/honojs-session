import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'

export class CookieWithContext {
    context: Context

    constructor(context: Context) {
      this.context = context
    }

    get(name: string) {
      return getCookie(this.context, name)
    }

    set(name: string, value: string, opt?: any) {
      return setCookie(this.context, name, value, opt)
    }

    delete(name: string, opt?: any) {
      return deleteCookie(this.context, name, opt)
    }
}