import React, { createContext, useContext, useMemo } from 'react';
import { Text } from 'react-native';
import { useTheme } from '../../../../theme';
import { splitByTerm } from '../../../../utils/highlightMatches';

/**
 * The term a list is searched for. `GenericFilterSortList` provides it around its rows and
 * `HighlightedText` marks it inside any title that opts in, so a result shows why it matched
 * without each list item having to know about the search.
 */
export const SearchHighlightContext = createContext<string>('');

const Mark: React.FC<{ children: string }> = ({ children }) => {
  const { colors } = useTheme();
  return (
    <Text style={{ backgroundColor: colors.primaryContainer, color: colors.onPrimaryContainer }}>
      {children}
    </Text>
  );
};

/** Plain text when nothing is searched or nothing matches; otherwise the match is marked. */
const HighlightedText: React.FC<{ text: string }> = ({ text }) => {
  const term = useContext(SearchHighlightContext);
  const segments = useMemo(() => splitByTerm(text, term), [text, term]);
  if (segments.length === 1 && !segments[0].match) return <>{text}</>;
  return (
    <>
      {segments.map((segment, index) =>
        segment.match ? (
          <Mark key={`${index}-m`}>{segment.text}</Mark>
        ) : (
          <React.Fragment key={`${index}-t`}>{segment.text}</React.Fragment>
        ),
      )}
    </>
  );
};

export default HighlightedText;
