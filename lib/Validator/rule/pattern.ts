import * as util from "../util";
// eslint-disable-next-line no-unused-vars
import { Rule } from "../index";
/**
 *  Rule for validating a regular expression pattern.
 *
 *  @param rule The validation rule.
 *  @param value The value of the field on the source object.
 *  @param source The source object being validated.
 *  @param errors An array of errors that this rule may add
 *  validation errors to.
 *  @param options The validation options.
 *  @param options.messages The validation messages.
 */
function pattern(rule: Rule, value: any, source: any, errors: any, options: any) {
    if (rule.pattern) {
        if (rule.pattern instanceof RegExp) {
            // if a RegExp instance is passed, reset `lastIndex` in case its `global`
            // flag is accidentally set to `true`, which in a validation scenario
            // is not necessary and the result might be misleading
            rule.pattern.lastIndex = 0;
            if (!rule.pattern.test(value)) {
                errors.push(util.format(
                    options.messages.pattern.mismatch,
                    rule.field,
                    value,
                    rule.pattern,
                ),);
            }
        } else if (typeof rule.pattern === "string") {
            const _pattern = new RegExp(rule.pattern);
            if (!_pattern.test(value)) {
                errors.push(util.format(
                    options.messages.pattern.mismatch,
                    rule.field,
                    value,
                    rule.pattern,
                ),);
            }
        }
    }
}

export default pattern;