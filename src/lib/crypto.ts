import { canonicalStringify } from "./canonical"
const keySettings = {
    name: 'ECDSA',
    namedCurve: 'P-256',
    hash: { name: 'SHA-256' },
}

export async function generateKeyPair(): Promise<{
    publicKeyBase64: string
    privateKey: CryptoKey
}> {
    const keyPair = await crypto.subtle.generateKey(
        keySettings,
        false,  // non-extractable
        ['sign', 'verify']
    )

    const publicKey = await crypto.subtle.exportKey('spki', keyPair.publicKey)

    return {
        publicKeyBase64: btoa(String.fromCharCode(...new Uint8Array(publicKey))),
        privateKey: keyPair.privateKey,
    }
}

export async function signData(
    formData: object | string,
    privateKey: CryptoKey,
    returnData: boolean = false
): Promise<{
    signature: string
    signaturePayload?: string
}> {
    let data: Uint8Array<ArrayBuffer>
    let canonical: string = ""

    if (typeof formData !== 'string') {
        canonical = canonicalStringify(formData)
        data = new TextEncoder().encode(canonical)
    }
    else {
        data = new TextEncoder().encode(formData)
    }
    
    const signature = await crypto.subtle.sign(
        keySettings,
        privateKey,
        data
    )

    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))

    if (returnData) {
        return {
            signature: signatureBase64,
            signaturePayload: canonical
        }
    }
    else {
        return {
            signature: signatureBase64
        }
    }
}

export async function verifySignature(
    formData: object | string,
    signatureBase64: string,
    publicKeyBase64: string
): Promise<boolean> {
    try {
        const publicKeyBytes = Uint8Array.from(atob(publicKeyBase64), c => c.charCodeAt(0))
        const publicKey = await crypto.subtle.importKey(
            'spki',
            publicKeyBytes,
            keySettings,
            false,
            ['verify']
        )

        let data: Uint8Array<ArrayBuffer>

        if (typeof formData !== 'string') {
            const canonical = canonicalStringify(formData)
            data = new TextEncoder().encode(canonical)
        }
        else {
            data = new TextEncoder().encode(formData)
        }

        const signature = Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0))

        return await crypto.subtle.verify(
            keySettings,
            publicKey,
            signature,
            data
        )
    } catch {
        return false
    }
}