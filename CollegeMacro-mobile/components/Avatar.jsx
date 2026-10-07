import React from 'react';
import { Text, View } from 'react-native';

// Emoji avatar on a tint of the person's accent color.
export default function Avatar({ emoji = '🍽️', color = '#32745f', size = 44 }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: `${color}26`,
        borderWidth: 2,
        borderColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.5 }}>{emoji}</Text>
    </View>
  );
}
