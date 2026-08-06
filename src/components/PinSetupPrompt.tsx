import React, { useState, useEffect } from 'react';
import { ShieldCheck, Fingerprint, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/Button';
import { registerBiometrics } from '../lib/webauthn';

export const PinSetupPrompt: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Only show if they haven't been prompted before and haven't set a pin
    const hasPrompted = localStorage.getItem('app_pin_prompted');
    const hasPin = localStorage.getItem('app_pin');
    
    if (!hasPrompted && !hasPin) {
      // Small delay so it doesn't jarringly pop up the millisecond they login
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleSkip = () => {
    localStorage.setItem('app_pin_prompted', 'true');
    setIsVisible(false);
  };

  const isWeakPin = (p: string) => {
    if (/^(\d)\1{3}$/.test(p)) return true; // 1111, 2222, etc
    if (p === '1234' || p === '2345' || p === '3456' || p === '4567' || p === '5678' || p === '6789') return true;
    if (p === '4321' || p === '5432' || p === '6543' || p === '7654' || p === '8765' || p === '9876') return true;
    return false;
  };

  const handleSavePin = () => {
    if (pin.length !== 4) {
      setErrorMsg('PIN must be exactly 4 digits');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }
    if (isWeakPin(pin)) {
      setErrorMsg('PIN is too easy to guess (avoid 1111, 1234, etc)');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }
    
    localStorage.setItem('app_pin', pin);
    localStorage.setItem('app_pin_prompted', 'true');
    sessionStorage.setItem('app_unlocked', 'true'); // Unlock current session
    
    // Check if device supports biometrics before showing step 2
    if (window.PublicKeyCredential) {
      setStep(2);
    } else {
      setIsVisible(false);
    }
  };

  const handleEnableBiometrics = async () => {
    try {
      const credId = await registerBiometrics();
      localStorage.setItem('biometric_id', credId);
      setIsVisible(false);
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to register biometrics');
      setTimeout(() => setErrorMsg(''), 3000);
    }
  };

  const handleSkipBiometrics = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        
        <div className="p-6 flex flex-col items-center text-center">
          {step === 1 ? (
            <>
              <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <ShieldCheck className="h-8 w-8 text-primary" />
              </div>
              
              <h2 className="text-xl font-bold mb-2">Secure Your Finances</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Add a 4-digit PIN to prevent unauthorized access if someone else uses your device.
              </p>

              <div className="w-full flex flex-col gap-3">
                <input
                  type="password"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="e.g. 5678"
                  className="w-full text-center px-4 py-3 rounded-xl border border-border bg-background text-2xl font-mono tracking-[0.5em] focus:ring-2 focus:ring-primary focus:outline-none"
                />
                
                {errorMsg && (
                  <p className="text-xs text-rose-500 font-bold">{errorMsg}</p>
                )}

                <Button 
                  onClick={handleSavePin} 
                  disabled={pin.length !== 4}
                  variant="primary" 
                  className="w-full py-6 text-base mt-2"
                >
                  Set PIN
                </Button>
                
                <Button 
                  onClick={handleSkip} 
                  variant="ghost" 
                  className="w-full text-muted-foreground hover:text-foreground"
                >
                  Skip for now
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="h-16 w-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4 relative">
                <CheckCircle2 className="h-8 w-8 text-green-500 absolute -top-1 -right-1 bg-card rounded-full" />
                <Fingerprint className="h-8 w-8 text-primary" />
              </div>
              
              <h2 className="text-xl font-bold mb-2">PIN Saved!</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Would you like to enable Biometrics (FaceID / Fingerprint) to unlock the app even faster?
              </p>

              <div className="w-full flex flex-col gap-3">
                {errorMsg && (
                  <p className="text-xs text-rose-500 font-bold">{errorMsg}</p>
                )}

                <Button 
                  onClick={handleEnableBiometrics} 
                  variant="primary" 
                  className="w-full py-6 text-base mt-2"
                >
                  Enable Biometrics
                </Button>
                
                <Button 
                  onClick={handleSkipBiometrics} 
                  variant="ghost" 
                  className="w-full text-muted-foreground hover:text-foreground"
                >
                  Not Now
                </Button>
              </div>
            </>
          )}
        </div>
        
        <div className="bg-muted/30 p-4 text-xs text-center text-muted-foreground border-t border-border">
          {step === 1 
            ? "You can always set this up later or enable Biometrics in the Settings tab."
            : "You can change this later in the Settings tab."}
        </div>
      </div>
    </div>
  );
};
