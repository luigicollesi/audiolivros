import React, { forwardRef, useCallback } from 'react';
import { Pressable, PressableProps } from 'react-native';
import { useSoundFx } from '@/features/sound/SoundProvider';

type Props = PressableProps & {
  disableClickSound?: boolean;
};

const ClickPressable = forwardRef<typeof Pressable, Props>((props, ref) => {
  const { playClick } = useSoundFx();
  const { onPress, disableClickSound, ...rest } = props;

  const handlePress = useCallback(
    (event) => {
      if (!disableClickSound) {
        playClick();
      }
      onPress?.(event);
    },
    [disableClickSound, onPress, playClick],
  );

  return <Pressable ref={ref as any} {...rest} onPress={handlePress} />;
});

ClickPressable.displayName = 'ClickPressable';

export default ClickPressable;
