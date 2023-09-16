export function downloadObject(filename: string, object: any): void {
    const jsonString = JSON.stringify(object);
    const blob = new Blob([jsonString], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}`;
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
}
