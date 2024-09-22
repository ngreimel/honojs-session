type MockEntry = {
    value: string
    expiration?: Date
}

type MockDatastore = {
    [key: string]: MockEntry | undefined
}

export class MockKV {
    datastore: MockDatastore
    namespace: KVNamespace
    debug: boolean
    now: Date | undefined

    constructor() {
        this.debug = false
        this.datastore = {}
        this.namespace = {
            get: async (key: string, options?: any): Promise<string | null> => {
                options = options || {}
                let now = this.now || new Date()
                if (this.datastore[key]?.expiration) {
                    const { value, expiration } = this.datastore[key]
                    this.debug && console.log({
                        actual_time: new Date(),
                        pretend_time: now,
                        expiration: expiration,
                        isExpired: now >= expiration,
                    })
                    return now < expiration ? value : null
                }
                return this.datastore[key]?.value || null
            },

            put: async (name: string, value: string, options?: { expirationTtl?: number }): Promise<void> => {
                let now = this.now || new Date()
                const exists = this.datastore[name] !== undefined
                const entry = {
                    value: value,
                    ...(options?.expirationTtl ? {expiration: new Date(now.getTime() + options.expirationTtl * 1000)} : {}),
                }
                this.debug && console.log({
                    now: now,
                    name: name,
                    entry: entry,
                    exists: exists,
                })

                this.datastore[name] = entry as MockEntry
            },

            list: async (): Promise<KVNamespaceListResult<any, any>> => {
                const keys = []
                for (const [key, value] of Object.entries(this.datastore)) {
                    const v = value as MockEntry
                    keys.push({
                        name: key,
                        ...(v.expiration ? {expiration: v.expiration} : {}),
                    } as KVNamespaceListKey<any, any>)
                }
                return {
                    list_complete: true,
                    keys: keys,
                    cacheStatus: null
                }
            },

            getWithMetadata: async (key: string): Promise<any> => {
                return this.datastore[key]
            },

            delete: async (key: string): Promise<any> => {
                const keyExists = this.datastore[key] !== undefined
                this.datastore[key] = undefined
                return keyExists
            },
        } as KVNamespace
    }
}
