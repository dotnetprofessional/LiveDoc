export function jsonIgnore(target: any, key: string) {
    Object.defineProperty(target, key, {
        enumerable: false,
    });
}