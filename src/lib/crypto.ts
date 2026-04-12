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
    privateKey: CryptoKey
): Promise<string> {
    let data: Uint8Array<ArrayBuffer>

    if (typeof formData !== 'string') {
        const canonical = JSON.stringify(formData, Object.keys(formData).sort())
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

    return btoa(String.fromCharCode(...new Uint8Array(signature)))
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
            const canonical = JSON.stringify(formData, Object.keys(formData).sort())
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