/** Minimal type declaration for bad-words v3 (no DefinitelyTyped package exists). */
declare module 'bad-words' {
  interface BadWordsOptions {
    emptyList?: boolean;
    list?: string[];
    placeHolder?: string;
    regex?: RegExp;
    replaceRegex?: RegExp;
    splitRegex?: RegExp;
  }

  class Filter {
    constructor(options?: BadWordsOptions);
    isProfane(string: string): boolean;
    clean(string: string): string;
    addWords(...words: string[]): void;
    removeWords(...words: string[]): void;
  }

  export = Filter;
}
