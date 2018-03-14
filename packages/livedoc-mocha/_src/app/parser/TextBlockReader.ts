export class TextBlockReader {
    private arrayOfLines: string[];
    private currentIndex: number = -1;

    constructor (text: string) {
        // Split text into lines for processing
        this.arrayOfLines = text.split(/\r?\n/);
    }

    public get count() {
        return this.arrayOfLines.length;
    }

    public get line(): string {
        if (this.currentIndex < this.count) {
            return this.arrayOfLines[this.currentIndex];
        } else {
            return null;
        }
    }

    public next(): boolean {
        this.currentIndex++;
        return this.currentIndex >= 0 && this.currentIndex < this.count;
    }

    public reset(): void {
        this.currentIndex = -1;
    }
}