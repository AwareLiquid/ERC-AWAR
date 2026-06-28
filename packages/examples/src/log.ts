/** Demo logger; defaults to a no-op so tests stay quiet. */
export type Log = (line: string) => void;

export const noop: Log = () => {};
