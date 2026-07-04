export const success = (data: unknown) => ({ success: true, data });

export const error = (message: string) => ({ success: false, error: message });
