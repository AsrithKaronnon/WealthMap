import React from 'react';
import { Dialog } from './Dialog';
import { Button } from './Button';
import { useConfirmStore } from '../../lib/useConfirmStore';

export const ConfirmDialog: React.FC = () => {
  const { isOpen, options, closeConfirm } = useConfirmStore();

  if (!options) return null;

  const handleConfirm = () => {
    options.onConfirm();
    closeConfirm();
  };

  const handleCancel = () => {
    if (options.onCancel) {
      options.onCancel();
    }
    closeConfirm();
  };

  return (
    <Dialog isOpen={isOpen} onClose={handleCancel} size="sm" title={options.title || 'Please Confirm'}>
      <div className="space-y-6">
        {options.description && (
          <p className="text-sm text-muted-foreground">
            {options.description}
          </p>
        )}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={handleCancel}>
            {options.cancelText || 'Cancel'}
          </Button>
          <Button 
            variant={options.destructive ? 'danger' : 'primary'} 
            onClick={handleConfirm}
            className={options.destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer' : 'cursor-pointer'}
          >
            {options.confirmText || 'Confirm'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
