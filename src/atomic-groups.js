import { RegexContext, replaceUnescaped } from './utils.js';

export function transformAtomicGroups(pattern) {
  if (!hasUnescapedInDefaultRegexContext(pattern, String.raw`\(\?>`)) {
    return pattern;
  }
  const token = new RegExp(String.raw`(?<groupStart>\(\?[:=!<>])|(?<backrefNum>\\[1-9]\d*)|\\?.`, 'gsu');
  const aGDelimLen = '(?>'.length;
  let hasProcessedAG;
  let aGCount = 0;
  do {
    hasProcessedAG = false;
    let numCharClassesOpen = 0;
    let numGroupsOpenInAG = 0;
    let aGPos = NaN;
    const inAG = () => !Number.isNaN(aGPos);
    token.lastIndex = Number.isNaN(aGPos) ? 0 : aGPos + aGDelimLen;
    let match;
    while (match = token.exec(pattern)) {
      const {0: m, index: pos, groups: {backrefNum, groupStart}} = match;
      if (m === '[') {
        numCharClassesOpen++;
      } else if (!numCharClassesOpen) {
        if (m === '(?>' && !inAG()) {
          aGPos = pos;
        } else if (groupStart && inAG()) {
          numGroupsOpenInAG++;
        } else if (m === ')' && inAG()) {
          if (!numGroupsOpenInAG) {
            aGCount++;
            const marker = `$AG$${aGCount}`;
            // Replace `pattern` and start over from the beginning position of the atomic group, in
            // case the processed group contains additional atomic groups
            pattern = `${pattern.slice(0, aGPos)}(?:(?=(?<${marker}>${pattern.slice(aGPos + aGDelimLen, pos)}))\\k<${marker}>)${pattern.slice(pos + 1)}`;
            hasProcessedAG = true;
            break;
          }
          numGroupsOpenInAG--;
        } else if (backrefNum) {
          // Could handle this with extra effort (adjusting both the backreferences found and those
          // used to emulate atomic groups) but it's probably not worth it for the edge case since
          // to trigger this the regex must contain both an atomic group and an interpolated RegExp
          // instance with a numbered backreference
          throw new Error(`Invalid delimal escape "${m}" in regex with atomic group; check interpolated regexes`);
        }
      } else if (m === ']') {
        numCharClassesOpen--;
      }
    }
  } while (hasProcessedAG);
  // Depollute the resulting `groups` object by replacing named groups and backrefs with numbers
  pattern = replaceUnescaped(
    pattern,
    String.raw`\(\?<\$AG\$\d+>|\\k<\$AG\$(?<backrefNum>\d+)>`,
    ({groups: {backrefNum}}) => backrefNum ? `\\${backrefNum}` : '(',
    RegexContext.DEFAULT
  );
  return pattern;
}

/**
Check if an unescaped version of a pattern appears outside of a character class.
Doesn't skip over complete multicharacter tokens (only `\` and folowing char) so must be used with
knowledge of what's safe to do given regex syntax.
Assumes flag v and doesn't worry about syntax errors that are caught by it.
@param {string} pattern
@param {string} needle Search as a regex pattern, with flags `su`
@returns {boolean}
*/
function hasUnescapedInDefaultRegexContext(pattern, needle) {
  // Quick partial test; avoids the loop in most cases
  if (!(new RegExp(needle, 'su')).test(pattern)) {
    return false;
  }
  const regex = new RegExp(String.raw`(?<found>${needle})|\\?.`, 'gsu');
  let numCharClassesOpen = 0;
  for (const {0: m, groups: {found}} of pattern.matchAll(regex)) {
    if (m === '[') {
      numCharClassesOpen++;
    } else if (!numCharClassesOpen) {
      if (found) {
        return true;
      }
    } else if (m === ']') {
      numCharClassesOpen--;
    }
  }
  return false;
}
