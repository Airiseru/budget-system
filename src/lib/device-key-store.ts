import { openDB } from 'idb'
import type { UserKey } from '@/src/types/keys'

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
    userKeyId: string,
    privateKey: CryptoKey
): Promise<void> {
    const db = await initIndexedDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    await Promise.all([
        tx.store.put(privateKey, `${KEY_PREFIX}${userKeyId}`),
        tx.done
    ])
}

export async function getPrivateKey(userKeyId: string): Promise<CryptoKey | null> {
    const db = await initIndexedDB()
    const key = await db.get(STORE_NAME, `${KEY_PREFIX}${userKeyId}`)
    return key
}

export async function removePrivateKey(userKeyId: string): Promise<void> {
    const db = await initIndexedDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    await Promise.all([
        tx.store.delete(`${KEY_PREFIX}${userKeyId}`),
        tx.done
    ])
}

export async function hasPrivateKey(userKeyId: string): Promise<boolean> {
    const db = await initIndexedDB()
    const key = await db.get(STORE_NAME, `${KEY_PREFIX}${userKeyId}`)
    return key !== undefined 
}

export type LocalSigningKey = {
    key: UserKey
    privateKey: CryptoKey
}

export async function findLocalActiveSigningKey(keys: UserKey[]): Promise<LocalSigningKey | null> {
    const activeKeys = keys.filter(key => key.status === 'active')

    for (const key of activeKeys) {
        const privateKey = await getPrivateKey(key.id)
        if (privateKey) {
            return { key, privateKey }
        }
    }

    return null
}

export async function findLocalSigningKeyById(keys: UserKey[], userKeyId: string): Promise<LocalSigningKey | null> {
    const key = keys.find(candidate => candidate.id === userKeyId)
    if (!key || key.status !== 'active') return null

    const privateKey = await getPrivateKey(key.id)
    if (!privateKey) return null

    return { key, privateKey }
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
