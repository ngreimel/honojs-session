export function getRandomId() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const hexValues: string[] = [];
    array.map((i: number): number => hexValues.push(i.toString(16)));
    return hexValues.join('');
}
