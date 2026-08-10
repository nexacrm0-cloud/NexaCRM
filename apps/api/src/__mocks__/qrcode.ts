export function toDataURL(text: string): Promise<string> {
  return Promise.resolve(`data:image/png;base64,${Buffer.from(text).toString('base64')}`);
}
