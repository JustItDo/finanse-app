export const SECURITY_PIN_LENGTH = 4;

export type SecuritySettings = {
  hasPin: boolean;
  biometricEnabled: boolean;
  autoLockOnResume: boolean;
};

export type SecurityCapabilities = {
  biometricAvailable: boolean;
  biometricLabel: string;
};

export function createDefaultSecuritySettings(): SecuritySettings {
  return {
    autoLockOnResume: true,
    biometricEnabled: false,
    hasPin: false,
  };
}

export function validatePin(pin: string) {
  return /^\d{4}$/.test(pin);
}

export function normalizePin(pin: string) {
  return pin.replace(/\D/g, '').slice(0, SECURITY_PIN_LENGTH);
}
