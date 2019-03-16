
/**
 * When added to a field member will prevent it from being serialized
 * by the JSON serializer. The field can still be set and read as usual.
 * 
 * @export
 * @param {*} target 
 * @param {string} key 
 */
export function jsonIgnore(target: any, key: string) {
    // thanks to rdmchenry for the logic to get this working!!
    const setupInstanceField = function (initialValue: any): any {
        let value = initialValue;

        const getter = function () {
            return value;
        };

        const setter = function (newVal) {
            value = newVal;
        };

        Object.defineProperty(this, key, {
            get: getter,
            set: setter,
            enumerable: false,
            configurable: false
        });
    };

    if (delete target[key]) {
        Object.defineProperty(target, key, {
            get: setupInstanceField as any,
            set: setupInstanceField,
            enumerable: false,
            configurable: true
        });
    }
}
