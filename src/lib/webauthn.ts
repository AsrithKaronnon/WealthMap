function generateChallenge() {
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);
  return challenge;
}

function bufferToBase64url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64urlToBuffer(base64url: string) {
  const padding = '='.repeat((4 - base64url.length % 4) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

export async function registerBiometrics(): Promise<string> {
  if (!window.PublicKeyCredential) {
    throw new Error('Biometrics not supported on this device/browser');
  }

  const userId = new Uint8Array(16);
  window.crypto.getRandomValues(userId);

  const publicKey: PublicKeyCredentialCreationOptions = {
    challenge: generateChallenge(),
    rp: {
      name: "Finapp Security",
    },
    user: {
      id: userId,
      name: "user",
      displayName: "App User",
    },
    pubKeyCredParams: [
      { type: "public-key", alg: -7 }, // ES256
      { type: "public-key", alg: -257 } // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: "platform", // Force on-device (FaceID, TouchID, Android Fingerprint)
      userVerification: "required", // Force biometric verification, not just presence
    },
    timeout: 60000,
    attestation: "none"
  };

  try {
    const credential = await navigator.credentials.create({ publicKey }) as PublicKeyCredential;
    if (!credential) throw new Error('Biometric registration failed or was cancelled');
    
    // Store the credential ID to use later for authentication
    return bufferToBase64url(credential.rawId);
  } catch (err: any) {
    console.error("WebAuthn error", err);
    throw new Error(err.message || 'Biometric registration failed');
  }
}

export async function verifyBiometrics(credentialIdBase64: string): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;

  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge: generateChallenge(),
    allowCredentials: [
      {
        type: "public-key",
        id: base64urlToBuffer(credentialIdBase64) as BufferSource,
      }
    ],
    userVerification: "required",
    timeout: 60000
  };

  try {
    const assertion = await navigator.credentials.get({ publicKey }) as PublicKeyCredential;
    return !!assertion;
  } catch (err) {
    console.error("Biometric verification failed", err);
    return false;
  }
}
