import { openDB } from 'idb'

const DB_NAME = process.env.NEXT_PUBLIC_INDEXED_DB_NAME ?? "device-key-store"
const STORE_NAME = process.env.NEXT_PUBLIC_INDEXED_STORE_NAME ?? "device-keys"
const KEY_PREFIX = process.env.NEXT_PUBLIC_INDEXED_KEY_PREFIX ?? "device-key-"

async function initIndexedDB() {
    return openDB(DB_NAME, 1, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME)
            }
        }
    })
}

export async function storePrivateKey(
    keyName: string,
    privateKey: CryptoKey
): Promise<void> {
    const db = await initIndexedDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    await Promise.all([
        tx.store.put(privateKey, `${KEY_PREFIX}${keyName}`),
        tx.done
    ])
}

export async function getPrivateKey(userId: string): Promise<CryptoKey | null> {
    const db = await initIndexedDB()
    const key = await db.get(STORE_NAME, `${KEY_PREFIX}${userId}`)
    return key
}

export async function removePrivateKey(userId: string): Promise<void> {
    const db = await initIndexedDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    await Promise.all([
        tx.store.delete(`${KEY_PREFIX}${userId}`),
        tx.done
    ])
}

export async function hasPrivateKey(userId: string): Promise<boolean> {
    const db = await initIndexedDB()
    const key = await db.get(STORE_NAME, `${KEY_PREFIX}${userId}`)
    return key !== undefined 
}

export function getDeviceName(): string {
    const userAgent = navigator.userAgent

    let browser = 'Browser'
    if (userAgent.includes('Edg')) browser = 'Edge'
    else if (userAgent.includes('Chrome')) browser = 'Chrome'
    else if (userAgent.includes('Firefox')) browser = 'Firefox'
    else if (userAgent.includes('Safari')) browser = 'Safari'

    let os = 'Unknown OS'
    if (userAgent.includes('Windows')) os = 'Windows'
    else if (userAgent.includes('Android')) os = 'Android'
    else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS'
    else if (userAgent.includes('Mac')) os = 'macOS'
    else if (userAgent.includes('Linux')) os = 'Linux'

    return `${browser} on ${os}`
}