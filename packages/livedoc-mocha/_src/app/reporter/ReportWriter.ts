export class ReportWriter {
    private buffer: string[] = [];

    /**
     * adds the text to the reporters output stream
     * 
     * @param {string} text 
     * @memberof ReportWriter
     */
    public writeLine(text: string | string[]) {
        if (Array.isArray(text)) {
            for (let i = 0; i < text.length; i++) {
                if (text[i]) {
                    this.buffer.push(text[i]);
                }
            }
        } else {
            if (text) {
                this.buffer.push(text);
            }
        }
    }

    public readOutput(): string {
        // concat all the strings
        return this.buffer.join("\n");
    }
}