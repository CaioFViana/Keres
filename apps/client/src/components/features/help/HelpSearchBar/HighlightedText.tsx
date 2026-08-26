import React from 'react';
import type { TextStyle } from 'react-native';
import { Text } from 'react-native';

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
export function HighlightedText({
  text,
  query,
  style,
  highlightColor,
}: {
  text: string;
  query: string;
  style?: TextStyle;
  highlightColor: string;
}) {
  const needle = normalize(query);
  const normalized = normalize(text);
  const index = needle ? normalized.indexOf(needle) : -1;
  if (index < 0) return <Text style={style}>{text}</Text>;
  let start = 0;
  let normalizedLength = 0;
  for (const char of text) {
    if (normalizedLength >= index) break;
    normalizedLength += normalize(char).length;
    start += char.length;
  }
  let end = start;
  let matchedLength = 0;
  for (const char of text.slice(start)) {
    if (matchedLength >= needle.length) break;
    matchedLength += normalize(char).length;
    end += char.length;
  }
  return (
    <Text style={style}>
      {text.slice(0, start)}
      <Text style={{ backgroundColor: highlightColor }}>{text.slice(start, end)}</Text>
      {text.slice(end)}
    </Text>
  );
}
