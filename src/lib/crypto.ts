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

export async function signFormData(
    formData: object,
    privateKey: CryptoKey
): Promise<string> {
    const canonical = JSON.stringify(formData, Object.keys(formData).sort())
    const data = new TextEncoder().encode(canonical)
    
    const signature = await crypto.subtle.sign(
        keySettings,
        privateKey,
        data
    )

    return btoa(String.fromCharCode(...new Uint8Array(signature)))
}

export async function verifySignature(
    formData: object,
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

        const canonical = JSON.stringify(formData, Object.keys(formData).sort())
        const data = new TextEncoder().encode(canonical)
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