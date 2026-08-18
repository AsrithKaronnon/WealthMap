import React from 'react';
import { PROJECT_EMOJIS } from '../../lib/projects';

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ value, onChange }) => {
  return (
    <div className="grid grid-cols-10 gap-1">
      {PROJECT_EMOJIS.map((emoji) => {
        const selected = value === emoji;
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onChange(emoji)}
            className={`h-9 w-full rounded-lg text-lg flex items-center justify-center cursor-pointer transition-colors ${
              selected ? 'bg-primary/15 ring-2 ring-primary/40' : 'hover:bg-muted/40'
            }`}
            aria-label={`Choose ${emoji}`}
            aria-pressed={selected}
          >
            {emoji}
          </button>
        );
      })}
    </div>
  );
};
