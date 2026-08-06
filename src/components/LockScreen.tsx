import React, { useState, useEffect } from 'react';
import { verifyBiometrics } from '../lib/webauthn';
import { Fingerprint, Lock, Delete } from 'lucide-react';

interface LockScreenProps {
  onUnlock: () => void;
}

export function LockScreen({ onUnlock }: LockScreenProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [checkingBio, setCheckingBio] = useState(false);

  const savedPin = localStorage.getItem('app_pin');
  const bioId = localStorage.getItem('biometric_id');

  useEffect(() => {
    // Attempt biometrics on load if configured
    if (bioId && !sessionStorage.getItem('app_unlocked')) {
      handleBiometricUnlock();
    }
  }, []);

  useEffect(() => {
    if (pin.length === 4) {
      if (pin === savedPin) {
        handleSuccess();
      } else {
        setError(true);
        setTimeout(() => {
          setPin('');
          setError(false);
        }, 500);
      }
    }
  }, [pin]);

  const handleSuccess = () => {
    sessionStorage.setItem('app_unlocked', 'true');
    onUnlock();
  };

  const handleBiometricUnlock = async () => {
    if (!bioId) return;
    setCheckingBio(true);
    try {
      const success = await verifyBiometrics(bioId);
      if (success) {
        handleSuccess();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCheckingBio(false);
    }
  };

  const handleDigit = (d: string) => {
    if (pin.length < 4) setPin(p => p + d);
  };

  const handleDelete = () => {
    setPin(p => p.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-md">
      <div className="flex flex-col items-center max-w-sm w-full px-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <Lock className="h-8 w-8 text-primary" />
        </div>
        
        <h2 className="text-xl font-bold mb-8">Enter PIN to Unlock</h2>
        
        <div className="flex gap-4 mb-12">
          {[0, 1, 2, 3].map(i => (
            <div 
              key={i} 
              className={`w-4 h-4 rounded-full transition-all duration-300 ${
                pin.length > i 
                  ? 'bg-primary scale-110' 
                  : 'bg-muted-foreground/20'
              } ${error ? 'bg-rose-500 animate-shake' : ''}`} 
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4 w-full mb-8">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              onClick={() => handleDigit(num.toString())}
              className="h-16 rounded-full bg-card/50 border border-border/50 text-2xl font-semibold hover:bg-muted active:scale-95 transition-all"
            >
              {num}
            </button>
          ))}
          
          <div className="flex items-center justify-center">
            {bioId && (
              <button
                onClick={handleBiometricUnlock}
                disabled={checkingBio}
                className="h-16 w-16 rounded-full flex items-center justify-center text-primary hover:bg-primary/10 active:scale-95 transition-all"
              >
                <Fingerprint className={`h-8 w-8 ${checkingBio ? 'animate-pulse' : ''}`} />
              </button>
            )}
          </div>
          
          <button
            onClick={() => handleDigit('0')}
            className="h-16 rounded-full bg-card/50 border border-border/50 text-2xl font-semibold hover:bg-muted active:scale-95 transition-all"
          >
            0
          </button>
          
          <button
            onClick={handleDelete}
            className="h-16 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted active:scale-95 transition-all"
          >
            <Delete className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
