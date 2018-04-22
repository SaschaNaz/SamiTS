﻿/* @internal */
module SamiTS.util {
    export function isEmptyOrEndsWithSpace(input: string) {
        return !input.length || input[input.length - 1] === ' ';
    }
    export function isEmptyOrEndsWithLinefeed(input: string) {
        return !input.length || input[input.length - 1] === '\n';
    }
    export function absorbSpaceEnding(input: string) {
        if (isEmptyOrEndsWithSpace(input))
            return input.slice(0, -1);
        else
            return input;
    }
    /** Fills the empty last line with a space for formats where the end of a cue is an empty line */
    export function manageLastLine(input: string, preventEmptyLine: boolean) {
        if (isEmptyOrEndsWithLinefeed(input) && preventEmptyLine)
            return input + ' ';
        else
            return input;
    }
    export function manageEmptyLines(input: string, preventEmptyLine: boolean) {
        if (!preventEmptyLine) {
            return input;
        }
        return input.replace(/\r?\n\r?\n/g, "\r\n \r\n");
    }
    export function generateTagReadResultTemplate(content = '') {
        return <TagReadResult>{ start: '', end: '', content };
    }
    /**
    Trim the input string if and only if its trimmed result is empty.
    */
    export function absorbAir(input: string) {
        var trimmed = input.trim();
        return trimmed.length != 0 ? input : trimmed;
    }
}
